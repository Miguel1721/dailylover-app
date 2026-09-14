import os, sys, re, asyncio, unicodedata, time, json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.config import get_settings
from app.routers.matchmaking import (
    resolve_client_user, evaluate_bidirectional_match,
    evaluate_attachment_compatibility, parse_attachment_style,
    parse_cm_height, get_slots_by_plan, evaluate_candidate_quick_notes_ai
)
import httpx

sys.stdout.reconfigure(line_buffering=True)

def clean_sheet_name(raw_name):
    if not raw_name:
        return ""
    cleaned = re.sub(r'\s*\((?:vip|tardeo|bogota|cali|medellin)[^)]*\)', '', raw_name, flags=re.IGNORECASE)
    cleaned = re.sub(r'\b(?:vip|tardeo)\b', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

async def init_db_tables(db):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS august27_ai_match_proposals (
            id SERIAL PRIMARY KEY,
            sheet_row INT,
            client_name TEXT,
            client_user_id INT,
            client_crm_id TEXT,
            dates_pend TEXT,
            responsable TEXT,
            candidate_name TEXT,
            candidate_user_id INT,
            candidate_crm_id TEXT,
            punctuation TEXT,
            status TEXT,
            points_to_consider TEXT,
            strong_points TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    await db.execute(text("CREATE INDEX IF NOT EXISTS idx_aug27_client_uid ON august27_ai_match_proposals(client_user_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS idx_aug27_sheet_row ON august27_ai_match_proposals(sheet_row)"))

    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS august27_unmatched_clients (
            id SERIAL PRIMARY KEY,
            sheet_row INT,
            sheet_name TEXT,
            clean_name TEXT,
            dates_pend TEXT,
            responsable TEXT,
            nota TEXT,
            reason TEXT DEFAULT 'No encontrado en base de datos',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    await db.execute(text("CREATE INDEX IF NOT EXISTS idx_aug27_unmatched_row ON august27_unmatched_clients(sheet_row)"))
    await db.commit()

async def get_already_processed_rows(db):
    res = await db.execute(text("SELECT DISTINCT sheet_row FROM august27_ai_match_proposals"))
    return set(r[0] for r in res.fetchall())

async def process_client(client_info, db, nvidia_key, http_client):
    """
    Procesa un cliente individual: busca candidatas estructurales, evalúa las mejores con IA clínica,
    y retorna la lista de filas formateadas para Google Sheets y Postgres.
    """
    uid = client_info["db_id"]
    user_row = await resolve_client_user(str(uid), db)
    if not user_row:
        return []

    # 1. Perfil del cliente
    prof_res = await db.execute(text("""
        SELECT p.gender, p.city, p.age, p.plan_tier, p.occupation, p.orientation, p.responsable,
               p.love_language, p.apego, p.estatura, p.search_preferences, p.bio_notes
        FROM profiles p WHERE p.user_id = :uid LIMIT 1
    """), {"uid": uid})
    prof_row = prof_res.fetchone()

    # Perfil extendido
    ext_res = await db.execute(text("SELECT * FROM client_extended_profile WHERE user_id = :uid LIMIT 1"), {"uid": uid})
    ext_row = ext_res.fetchone()
    ext_data = dict(ext_row._mapping) if ext_row else {}

    client_city = (prof_row.city if prof_row and prof_row.city else "Bogotá").strip()
    client_gender = (prof_row.gender if prof_row and prof_row.gender else "Hombre").strip().lower()
    client_age = int(prof_row.age) if prof_row and prof_row.age else None
    client_prefs = (prof_row.search_preferences if prof_row and prof_row.search_preferences else {}) or {}
    client_height_cm = parse_cm_height(prof_row.estatura) if prof_row and prof_row.estatura else None
    client_sg = float(ext_data["social_group_score"]) if ext_data.get("social_group_score") is not None else None
    client_act = int(ext_data["physical_activity_level"]) if ext_data.get("physical_activity_level") is not None else None
    client_attachment = parse_attachment_style(prof_row.apego if prof_row else None)

    client_summary = {
        "user_id": user_row.id,
        "name": user_row.name,
        "gender": prof_row.gender if prof_row else "Hombre",
        "city": client_city,
        "age": client_age,
        "occupation": prof_row.occupation if prof_row and prof_row.occupation else "",
        "attachment_style": client_attachment,
        "bio_notes": prof_row.bio_notes if prof_row and prof_row.bio_notes else "",
        "search_preferences": client_prefs,
        "non_negotiables": ext_data.get("non_negotiables") or []
    }

    is_male = "homb" in client_gender or "masc" in client_gender
    gender_filter_sql = "(p.gender ILIKE '%fem%' OR p.gender ILIKE '%muj%')" if is_male else "(p.gender ILIKE '%homb%' OR p.gender ILIKE '%masc%')"
    anti_opposite_name_sql = (
        "AND u.name !~* '^(miguel|juan|carlos|diego|andres|pedro|luis|felipe|daniel|sebastian|jorge|pablo|alejandro|david|mateo|santiago|cristian|victor|gabriel|nicolas|camilo)'"
        if is_male else
        "AND u.name !~* '^(maria|paula|laura|diana|daniela|valentina|natalia|camila|sofia|alejandra|juliana|catalina|andrea|carolina|angie|sara)'"
    )
    city_sql = ""
    if client_city and client_city.lower() != "todas":
        clean_city_prefix = client_city.split()[0].replace(",", "").strip()
        city_sql = f"AND (p.city IS NULL OR p.city = '' OR p.city ILIKE '%{clean_city_prefix}%')"

    # Buscar hasta 30 candidatos potenciales en base de datos
    cand_res = await db.execute(text(f"""
        SELECT u.id, u.name, u.phone, u.crm_id, u.client_code,
               p.gender, p.city, p.age, p.plan_tier, p.occupation, p.responsable,
               p.estatura, p.search_preferences, p.bio_notes, p.apego, p.orientation,
               cep.social_group_score, cep.physical_activity_level, cep.education_level,
               cep.love_language_given, cep.non_negotiables, cep.synthesis_who_really_is
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        LEFT JOIN client_extended_profile cep ON cep.user_id = u.id
        WHERE u.id != :uid
          AND u.merged_into_id IS NULL
          AND u.name NOT ILIKE 'Cliente CRM%'
          AND u.name NOT ILIKE 'Sin nombre%'
          AND u.name NOT ILIKE '%unknown%'
          AND u.name !~* '^(no match|not approved|no hay|aprobado|refund|descalificado|trouble|unknown|cliente)'
          AND {gender_filter_sql}
          {anti_opposite_name_sql}
          {city_sql}
          AND (p.orientation IS NULL OR p.orientation = '' OR p.orientation ILIKE '%hetero%' OR p.orientation ILIKE '%bi%')
          AND (p.bio_notes IS NULL OR p.bio_notes !~* '(no quiere m.s (citas|dates)|no m.s (citas|dates)|pidio devolucion|descalificad|en pausa|refund|no desea m.s)')
        ORDER BY (p.bio_notes IS NOT NULL AND LENGTH(p.bio_notes) > 80) DESC,
                 (p.occupation IS NOT NULL AND p.occupation != '') DESC,
                 (p.age IS NOT NULL) DESC,
                 u.id DESC
        LIMIT 30
    """), {"uid": uid})
    cand_rows = cand_res.fetchall()

    if not cand_rows:
        # Fallback sin filtro estricto de ciudad si la ciudad no tiene inventario
        cand_res = await db.execute(text(f"""
            SELECT u.id, u.name, u.phone, u.crm_id, u.client_code,
                   p.gender, p.city, p.age, p.plan_tier, p.occupation, p.responsable,
                   p.estatura, p.search_preferences, p.bio_notes, p.apego, p.orientation,
                   cep.social_group_score, cep.physical_activity_level, cep.education_level,
                   cep.love_language_given, cep.non_negotiables, cep.synthesis_who_really_is
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            LEFT JOIN client_extended_profile cep ON cep.user_id = u.id
            WHERE u.id != :uid
              AND u.merged_into_id IS NULL
              AND u.name NOT ILIKE 'Cliente CRM%'
              AND u.name NOT ILIKE 'Sin nombre%'
              AND u.name NOT ILIKE '%unknown%'
              AND u.name !~* '^(no match|not approved|no hay|aprobado|refund|descalificado|trouble|unknown|cliente)'
              AND {gender_filter_sql}
              {anti_opposite_name_sql}
              AND (p.orientation IS NULL OR p.orientation = '' OR p.orientation ILIKE '%hetero%' OR p.orientation ILIKE '%bi%')
              AND (p.bio_notes IS NULL OR p.bio_notes !~* '(no quiere m.s (citas|dates)|no m.s (citas|dates)|pidio devolucion|descalificad|en pausa|refund|no desea m.s)')
            ORDER BY (p.bio_notes IS NOT NULL AND LENGTH(p.bio_notes) > 80) DESC,
                     (p.occupation IS NOT NULL AND p.occupation != '') DESC,
                     (p.age IS NOT NULL) DESC,
                     u.id DESC
            LIMIT 20
        """), {"uid": uid})
        cand_rows = cand_res.fetchall()

    if not cand_rows:
        return [{
            "sheet_row": client_info["sheet_row"],
            "client_name": client_info["sheet_name"],
            "client_user_id": uid,
            "client_crm_id": client_info["crm_id"] or "",
            "dates_pend": client_info["dates_pend"],
            "responsable": client_info["responsable"],
            "candidate_name": "",
            "candidate_user_id": None,
            "candidate_crm_id": "",
            "punctuation": "",
            "status": "SIN MATCH VIABLE",
            "points_to_consider": f"SIN MATCH VIABLE - SUPPLY GAP: No hay inventario de candidatos activos en {client_city} que cumplan criterios básicos de género y estado.",
            "strong_points": ""
        }]

    # Filtrar historial previo y ordenar por afinidad estructural
    viable_cands = []
    seen_names = set()
    for r in cand_rows:
        cname = (r.name or "").strip()
        if not cname or cname.lower() in seen_names:
            continue
        seen_names.add(cname.lower())

        # Descartar si ya tuvieron cita juntos
        prev = await db.execute(text("""
            SELECT COUNT(*) FROM operational_matches
            WHERE ((LOWER(TRIM(person_a)) = LOWER(TRIM(:a)) AND LOWER(TRIM(person_b)) = LOWER(TRIM(:b)))
               OR  (LOWER(TRIM(person_a)) = LOWER(TRIM(:b)) AND LOWER(TRIM(person_b)) = LOWER(TRIM(:a))))
              AND status IN ('HECHO', 'APROBADO', 'cita realizada', 'DATE REALIZADO', 'MATCH DONE', 'CITA COMPLETADA', 'cita confirmada')
        """), {"a": user_row.name, "b": cname})
        if (prev.scalar() or 0) > 0:
            continue

        bidi = evaluate_bidirectional_match(client_summary, r, client_prefs, client_height_cm)
        if not bidi["age_ok"] and bidi["age_alerts"]:
            continue

        # Score estructural básico
        struct_pts = 70
        if r.bio_notes and len(r.bio_notes) > 100:
            struct_pts += 10
        if r.city and client_city and r.city.lower() == client_city.lower():
            struct_pts += 10
        if bidi["is_bidirectionally_compatible"]:
            struct_pts += 5

        viable_cands.append({
            "cand_row": r,
            "struct_score": min(95, struct_pts),
            "bidi": bidi
        })

    if not viable_cands:
        return [{
            "sheet_row": client_info["sheet_row"],
            "client_name": client_info["sheet_name"],
            "client_user_id": uid,
            "client_crm_id": client_info["crm_id"] or "",
            "dates_pend": client_info["dates_pend"],
            "responsable": client_info["responsable"],
            "candidate_name": "",
            "candidate_user_id": None,
            "candidate_crm_id": "",
            "punctuation": "",
            "status": "SIN MATCH VIABLE",
            "points_to_consider": f"SIN MATCH VIABLE - INCOMPATIBILIDAD MUTUA: Los candidatos en {client_city} violan el rango de edad/estatura mutuo o ya tuvieron cita previa.",
            "strong_points": ""
        }]

    # Tomar las mejores 2 o 3 candidatas para evaluar con IA Clínica
    viable_cands.sort(key=lambda x: x["struct_score"], reverse=True)
    top_candidates = viable_cands[:2]

    results = []
    for item in top_candidates:
        r = item["cand_row"]
        cand_name = r.name.strip()
        cand_bio = (r.bio_notes or "").strip()

        cand_payload = {
            "name": cand_name,
            "age": r.age,
            "city": r.city or client_city,
            "occupation": r.occupation or "",
            "attachment_style": parse_attachment_style(r.apego),
            "bio_notes": cand_bio,
            "search_preferences": r.search_preferences or {},
            "non_negotiables": []
        }

        ai_res = await evaluate_candidate_quick_notes_ai(client_summary, cand_payload, nvidia_key, http_client)
        ai_score = ai_res.get("ai_score") or item["struct_score"]
        verdict = ai_res.get("veredicto") or "VIABLE"
        dbs = ai_res.get("deal_breakers") or []
        puntos = ai_res.get("puntos_fuertes") or []
        analisis = ai_res.get("analisis") or ""

        # Escalar puntuación a 1-10
        punct_10 = str(max(1, min(10, round(ai_score / 10.0))))

        # Puntos a considerar / dealbreakers
        points_to_consider = ""
        if dbs:
            points_to_consider = f"⚠️ Dealbreakers / Puntos de atención: {'; '.join(dbs)}. "
        elif verdict == "VIABLE CON RESERVAS":
            points_to_consider = "Viable con reservas: verificar disponibilidad o expectativas mutuas. "
        else:
            points_to_consider = "Sin dealbreakers detectados en las notas clínicas. "
        if analisis:
            points_to_consider += f"Contexto clínico: {analisis}"

        # Puntos fuertes
        strong_points = ""
        if puntos:
            strong_points = f"Puntos fuertes: {'; '.join(puntos)}. "
        if r.occupation:
            strong_points += f"Ocupación: {r.occupation}. "
        if r.city:
            strong_points += f"Ubicación: {r.city}. "

        results.append({
            "sheet_row": client_info["sheet_row"],
            "client_name": client_info["sheet_name"],
            "client_user_id": uid,
            "client_crm_id": client_info["crm_id"] or "",
            "dates_pend": client_info["dates_pend"],
            "responsable": client_info["responsable"],
            "candidate_name": cand_name,
            "candidate_user_id": r.id,
            "candidate_crm_id": str(r.crm_id or "") if r.crm_id else "",
            "punctuation": punct_10,
            "status": "PROPOSED" if verdict != "NO RECOMENDADO" else "NO RECOMENDADO",
            "points_to_consider": points_to_consider.strip(),
            "strong_points": strong_points.strip()
        })

    return results

async def main():
    limit_test = None
    if len(sys.argv) > 1:
        try:
            limit_test = int(sys.argv[1])
            print(f"Modo ejecución con límite de {limit_test} clientes.")
        except Exception:
            pass

    service_account_path = "/app/service_account.json"
    if not os.path.exists(service_account_path):
        service_account_path = "backend/service_account.json"

    creds = Credentials.from_service_account_file(
        service_account_path,
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    service = build('sheets', 'v4', credentials=creds)
    sheet_id = os.environ.get("AGOSTO27_SHEET_ID", "1tCV7lIE-uypmDELyNz9bWdS95DEzCHO9EUbCszVa9co")

    settings = get_settings()
    nvidia_key = (settings.nvidia_api_key or os.getenv("NVIDIA_API_KEY") or "").strip()
    if not nvidia_key:
        for env_path in ["/app/.env", ".env", "../.env"]:
            if os.path.exists(env_path):
                with open(env_path, "r", encoding="utf-8", errors="ignore") as f:
                    for l in f:
                        if l.strip().startswith("NVIDIA_API_KEY="):
                            nvidia_key = l.strip().split("=", 1)[1].strip().strip("\"'")
                            break
            if nvidia_key:
                break

    if not nvidia_key or len(nvidia_key) < 10:
        print("ERROR: NVIDIA_API_KEY no encontrada o inválida.")
        return

    # Leer Google Sheet
    result = service.spreadsheets().values().get(
        spreadsheetId=sheet_id,
        range="'Missing Matches'!A1:E600"
    ).execute()
    rows = result.get('values', [])

    resolved_patterns = [
        r'ya\s+tiene.*match', r'match.*aprobado', r'tiene\s+\d+\s+nuevos?\s+match',
        r'\baprobado\b', r'ya\s+se\s+le\s+hizo\s+match', r'match\s+hecho',
        r'ya\s+se\s+le\s+hicieron', r'ya\s+tiene\s+match', r'\bdone\b', r'\bok\b',
        r'ya\s+le\s+hice\s+match', r'ya\s+estan\s+ambos', r'ya\s+esta\s+en\s+mi\s+tab',
        r'ya\s+tiene\s+su\s+match'
    ]
    refund_patterns = [
        r'refund', r'no\s+hay\s+gente', r'no\s+hay\s+candidat', r'ofrecer\s+refund',
        r'pedir\s+refund', r'devolucion', r'no\s+hay\s+perfiles', r'descalificad'
    ]
    no_crm_patterns = [
        r'no\s+lo\s+encontr[eé]\s+en\s+(el\s+)?crm', r'no\s+est[aá]\s+en\s+(el\s+)?crm',
        r'no\s+existe\s+en\s+(el\s+)?crm', r'sin\s+perfil\s+en\s+(el\s+)?crm',
        r'nunca\s+llego\s+el\s+perfil\s+de\s+crm'
    ]

    valid_pending = []
    for idx, r in enumerate(rows[1:], start=2):
        resp = r[0].strip() if len(r) > 0 and r[0] else ""
        fecha = r[1].strip() if len(r) > 1 and r[1] else ""
        raw_name = r[2].strip() if len(r) > 2 and r[2] else ""
        dates_pend = r[3].strip() if len(r) > 3 and r[3] else ""
        nota = r[4].strip() if len(r) > 4 and r[4] else ""

        if not raw_name:
            continue
        nl = nota.lower()
        if any(re.search(p, nl) for p in resolved_patterns):
            continue
        if any(re.search(p, nl) for p in refund_patterns):
            continue
        if any(re.search(p, nl) for p in no_crm_patterns):
            continue

        valid_pending.append({
            "row": idx,
            "resp": resp,
            "fecha": fecha,
            "raw_name": raw_name,
            "clean_name": clean_sheet_name(raw_name),
            "dates_pend": dates_pend,
            "nota": nota
        })

    print(f"Total filas pendientes filtradas: {len(valid_pending)}")

    async with AsyncSessionLocal() as db:
        await init_db_tables(db)
        already_processed = await get_already_processed_rows(db)
        print(f"Filas ya procesadas previamente en BD: {len(already_processed)}")

        # Emparejar con base de datos
        matched_clients = []
        for p in valid_pending:
            if p["row"] in already_processed:
                continue
            cname = p["clean_name"]
            res = await db.execute(text("""
                SELECT id, name, crm_id, phone, client_code
                FROM users WHERE unaccent(LOWER(TRIM(name))) = unaccent(LOWER(TRIM(:n))) LIMIT 1
            """), {"n": cname})
            urow = res.fetchone()

            if not urow:
                res = await db.execute(text("""
                    SELECT id, name, crm_id, phone, client_code
                    FROM users WHERE unaccent(LOWER(name)) LIKE unaccent(LOWER(:like_n))
                    ORDER BY id DESC LIMIT 1
                """), {"like_n": f"%{cname}%"})
                urow = res.fetchone()

            if not urow:
                tokens = [t for t in cname.split() if len(t) > 2]
                if len(tokens) >= 2:
                    res = await db.execute(text("""
                        SELECT id, name, crm_id, phone, client_code
                        FROM users WHERE unaccent(LOWER(name)) LIKE unaccent(LOWER(:t1))
                          AND unaccent(LOWER(name)) LIKE unaccent(LOWER(:t2))
                        ORDER BY id DESC LIMIT 1
                    """), {"t1": f"%{tokens[0]}%", "t2": f"%{tokens[1]}%"})
                    urow = res.fetchone()

            if urow:
                matched_clients.append({
                    "sheet_row": p["row"],
                    "sheet_name": p["raw_name"],
                    "db_id": urow[0],
                    "db_name": urow[1],
                    "crm_id": urow[2],
                    "dates_pend": p["dates_pend"],
                    "responsable": p["resp"],
                    "nota": p["nota"]
                })

        print(f"Clientes listos para procesar ahora: {len(matched_clients)}")
        if limit_test:
            matched_clients = matched_clients[:limit_test]
            print(f"Acotado a lote de prueba: {len(matched_clients)} clientes.")

        total_to_process = len(matched_clients)
        sheet_rows_to_append = []

        async with httpx.AsyncClient() as http_client:
            for i, client in enumerate(matched_clients, 1):
                t_client = time.time()
                print(f"[{i}/{total_to_process}] Procesando fila {client['sheet_row']}: '{client['sheet_name']}' (ID {client['db_id']})...")

                try:
                    proposals = await process_client(client, db, nvidia_key, http_client)
                except Exception as ex:
                    print(f"  ERROR procesando cliente {client['sheet_name']}: {ex}")
                    continue

                for prop in proposals:
                    # Guardar en PostgreSQL
                    await db.execute(text("""
                        INSERT INTO august27_ai_match_proposals (
                            sheet_row, client_name, client_user_id, client_crm_id,
                            dates_pend, responsable, candidate_name, candidate_user_id,
                            candidate_crm_id, punctuation, status, points_to_consider, strong_points
                        ) VALUES (
                            :sr, :cn, :cuid, :ccid, :dp, :resp, :candn, :canduid, :candcid,
                            :punct, :st, :ptc, :sp
                        )
                    """), {
                        "sr": prop["sheet_row"],
                        "cn": prop["client_name"],
                        "cuid": prop["client_user_id"],
                        "ccid": prop["client_crm_id"],
                        "dp": prop["dates_pend"],
                        "resp": prop["responsable"],
                        "candn": prop["candidate_name"],
                        "canduid": prop["candidate_user_id"],
                        "candcid": prop["candidate_crm_id"],
                        "punct": prop["punctuation"],
                        "st": prop["status"],
                        "ptc": prop["points_to_consider"],
                        "sp": prop["strong_points"]
                    })
                    await db.commit()

                    # Preparar fila para Google Sheet
                    # Columns: ['A1', 'Possible Match', 'Punctuation', 'STATUS', 'Points to consider', 'Strong Points of the match ', 'Dates Pendientes', 'Responsable', 'Fila Sheet']
                    sheet_rows_to_append.append([
                        prop["client_name"],
                        prop["candidate_name"],
                        prop["punctuation"],
                        prop["status"],
                        prop["points_to_consider"],
                        prop["strong_points"],
                        prop["dates_pend"],
                        prop["responsable"],
                        prop["sheet_row"]
                    ])

                    print(f"  -> Match Propuesto: '{prop['candidate_name']}' | Puntuación: {prop['punctuation']}/10 | Estado: {prop['status']}")

                print(f"  Completado en {time.time()-t_client:.2f}s")

                # Escritura en Google Sheet cada 5 clientes o al final
                if len(sheet_rows_to_append) >= 10 or i == total_to_process:
                    try:
                        service.spreadsheets().values().append(
                            spreadsheetId=sheet_id,
                            range="'Matches proposed - IA Agosto 27'!A2",
                            valueInputOption="RAW",
                            insertDataOption="INSERT_ROWS",
                            body={"values": sheet_rows_to_append}
                        ).execute()
                        print(f"  ==> {len(sheet_rows_to_append)} filas escritas a Google Sheet exitosamente.")
                        sheet_rows_to_append = []
                    except Exception as s_err:
                        print(f"  Aviso al escribir en Google Sheet: {s_err}")

        print(f"\n<<< PIPELINE COMPLETADO EXITOSAMENTE >>>")

if __name__ == "__main__":
    asyncio.run(main())
