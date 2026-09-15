import os, sys, re, asyncio, unicodedata, time, json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.config import get_settings
from app.routers.matchmaking import (
    resolve_client_user, evaluate_bidirectional_match,
    evaluate_attachment_compatibility, parse_attachment_style,
    parse_cm_height, get_slots_by_plan, evaluate_candidate_quick_notes_ai,
    find_candidate_matches_engine
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

async def process_client(client_info, db, nvidia_key, http_client, candidate_usage_tracker=None, max_candidate_usage=4):
    """
    Procesa un cliente individual usando el motor unificado find_candidate_matches_engine
    con selección de pool de 60 candidatos, filtro estructural multidimensional,
    evaluación clínica de IA y control de tope de diversidad.
    Retorna la lista de filas formateadas para Google Sheets y Postgres.
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

    ext_res = await db.execute(text("SELECT * FROM client_extended_profile WHERE user_id = :uid LIMIT 1"), {"uid": uid})
    ext_row = ext_res.fetchone()
    ext_data = dict(ext_row._mapping) if ext_row else {}

    client_city = (prof_row.city if prof_row and prof_row.city else "Bogotá").strip()
    client_gender = (prof_row.gender if prof_row and prof_row.gender else "Hombre").strip().lower()
    client_age = int(prof_row.age) if prof_row and prof_row.age else None
    if not client_age and prof_row and prof_row.bio_notes:
        m_c_age = re.search(r'(\d{2})\s*a[ñn]os', prof_row.bio_notes, re.IGNORECASE) or re.search(r'edad:\s*(\d{2})', prof_row.bio_notes, re.IGNORECASE)
        if m_c_age:
            try:
                client_age = int(m_c_age.group(1))
            except Exception:
                pass

    client_prefs = (prof_row.search_preferences if prof_row and prof_row.search_preferences else {}) or {}
    client_sg = float(ext_data["social_group_score"]) if ext_data.get("social_group_score") is not None else None
    client_act = int(ext_data["physical_activity_level"]) if ext_data.get("physical_activity_level") is not None else None
    client_edu = int(ext_data["education_level"]) if ext_data.get("education_level") is not None else None
    client_attachment = parse_attachment_style(prof_row.apego if prof_row else None)

    client_summary = {
        "user_id": user_row.id,
        "name": user_row.name,
        "phone": user_row.phone or "",
        "crm_id": str(user_row.crm_id or "") if user_row.crm_id else "",
        "client_code": user_row.client_code or f"DL-{user_row.id}",
        "city": client_city,
        "gender": prof_row.gender if prof_row else "Hombre",
        "age": client_age,
        "estatura": prof_row.estatura if prof_row and prof_row.estatura else "",
        "occupation": prof_row.occupation if prof_row and prof_row.occupation else "",
        "plan_tier": prof_row.plan_tier if prof_row and prof_row.plan_tier else "Estándar 65k (2 citas)",
        "responsable": prof_row.responsable if prof_row and prof_row.responsable else (ext_data.get("updated_by") or "Psicóloga"),
        "attachment_style": client_attachment,
        "social_group_score": client_sg,
        "education_level": client_edu,
        "physical_activity_level": client_act,
        "social_energy_level": ext_data.get("social_energy_level"),
        "love_language_given": ext_data.get("love_language_given") or "No especificado",
        "love_language_received": ext_data.get("love_language_received") or "No especificado",
        "non_negotiables": ext_data.get("non_negotiables") or [],
        "synthesis_who_really_is": ext_data.get("synthesis_who_really_is", ""),
        "bio_notes": prof_row.bio_notes if prof_row and prof_row.bio_notes else "",
        "search_preferences": client_prefs
    }

    # 2. Ejecutar motor unificado con pool de 60 y tope de diversidad
    matches = await find_candidate_matches_engine(
        client_summary=client_summary,
        db=db,
        pool_limit=60,
        max_ai_evaluations=3,
        candidate_usage_tracker=candidate_usage_tracker,
        max_candidate_usage=max_candidate_usage,
        nvidia_key=nvidia_key,
        http_client=http_client
    )

    if not matches:
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
            "points_to_consider": f"SIN MATCH VIABLE - SUPPLY GAP: No hay candidatos compatibles en {client_city} que cumplan los criterios básicos o filtros estructurales mutuos.",
            "strong_points": ""
        }]

    # Tomar los 2 mejores candidatos
    top_matches = matches[:2]
    results = []

    for cand in top_matches:
        cand_uid = cand["user_id"]
        cand_name = cand["name"]

        # Actualizar contador de uso de candidato para la corrida
        if candidate_usage_tracker is not None:
            candidate_usage_tracker[cand_uid] = candidate_usage_tracker.get(cand_uid, 0) + 1

        # Score y veredicto con coherencia clínica estricta
        score_val = cand.get("compatibility_pct") if cand.get("compatibility_pct") is not None else cand.get("structural_score")
        verdict = cand.get("ai_veredicto") or "VIABLE"
        dbs = cand.get("ai_deal_breakers") or []
        puntos = cand.get("ai_puntos_fuertes") or []

        if score_val is not None:
            raw_punct = round(score_val / 10.0)
            if verdict == "VIABLE CON RESERVAS":
                # Tope estricto: cuando la clínica arroja reservas, nunca presentar más de 6/10
                punct_num = min(int(raw_punct), 6)
            elif verdict == "NO RECOMENDADO" or len(dbs) > 0:
                punct_num = min(int(raw_punct), 3)
            else:
                punct_num = int(raw_punct)
            punct_10 = str(max(1, min(10, punct_num)))
        else:
            punct_10 = "S/D"

        # Evitar fugas de diccionarios Python en el análisis clínico
        analisis_raw = cand.get("ai_analisis") or cand.get("match_analysis") or ""
        if isinstance(analisis_raw, dict):
            analisis = (analisis_raw.get("why_ideal") or "").strip()
        else:
            analisis = str(analisis_raw or "").strip()

        # Puntos a considerar
        points_to_consider = ""
        if dbs:
            points_to_consider = f"⚠️ Dealbreakers / Puntos de fricción: {'; '.join(dbs)}. "
        elif verdict == "VIABLE CON RESERVAS":
            points_to_consider = "Viable con reservas: verificar disponibilidad o expectativas mutuas. "
        else:
            points_to_consider = "Sin dealbreakers detectados en las notas clínicas. "

        if not cand.get("dealbreakers_clean") and cand.get("dealbreakers_check"):
            points_to_consider += f"{cand['dealbreakers_check']}. "

        if analisis:
            points_to_consider += f"Contexto clínico: {analisis}"

        # Puntos fuertes (limpieza de clichés o puntuación duplicada)
        strong_parts = []
        if puntos:
            clean_puntos = [p.strip().rstrip('.') for p in puntos if p and len(p.strip()) > 3]
            if clean_puntos:
                strong_parts.append(f"Puntos fuertes: {'; '.join(clean_puntos)}.")
        if cand.get("occupation") and cand.get("occupation") != "No especificado":
            strong_parts.append(f"Ocupación: {cand['occupation']}.")
        if cand.get("city"):
            strong_parts.append(f"Ubicación: {cand['city']}.")
        strengths = cand.get("strengths") or []
        if strengths:
            strong_parts.append(f"Afinidad: {'; '.join(strengths[:2])}.")

        strong_points = " ".join(strong_parts).strip()
        status_val = "PROPOSED" if verdict != "NO RECOMENDADO" else "NO RECOMENDADO"

        results.append({
            "sheet_row": client_info["sheet_row"],
            "client_name": client_info["sheet_name"],
            "client_user_id": uid,
            "client_crm_id": client_info["crm_id"] or "",
            "dates_pend": client_info["dates_pend"],
            "responsable": client_info["responsable"],
            "candidate_name": cand_name,
            "candidate_user_id": cand_uid,
            "candidate_crm_id": str(cand.get("crm_id") or "") if cand.get("crm_id") else "",
            "punctuation": punct_10,
            "status": status_val,
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

        # Rastrear uso de candidatos para garantizar tope de diversidad (máximo 4 apariciones)
        candidate_usage_tracker = {}
        usage_res = await db.execute(text("""
            SELECT candidate_user_id, COUNT(*)
            FROM august27_ai_match_proposals
            WHERE candidate_user_id IS NOT NULL AND status = 'PROPOSED'
            GROUP BY candidate_user_id
        """))
        for urow in usage_res.fetchall():
            if urow[0] is not None:
                candidate_usage_tracker[urow[0]] = int(urow[1])
        print(f"Candidatos ya con propuestas en BD: {len(candidate_usage_tracker)}")

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
                    proposals = await process_client(
                        client, db, nvidia_key, http_client,
                        candidate_usage_tracker=candidate_usage_tracker,
                        max_candidate_usage=4
                    )
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
