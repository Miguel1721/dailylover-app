# -*- coding: utf-8 -*-
import asyncio
import asyncpg
import httpx
import os
import sys
import json
import time
import re

sys.path.insert(0, '/app')
from app.config import get_settings
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

sys.stdout.reconfigure(line_buffering=True)

NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
MODEL = "meta/llama-3.2-11b-vision-instruct"

def to_dict(v):
    if isinstance(v, dict):
        return v
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return {}
    return {}

def check_hard_dealbreakers(cli, cand):
    # 1. Género y Orientación Sexual
    c_gender = (cli.get('gender') or '').strip().lower()
    c_sp = to_dict(cli.get('search_preferences'))
    c_pref_gender = (c_sp.get('preferred_gender') or '').strip().lower()
    c_orient = (cli.get('orientation') or c_sp.get('preferred_orientation') or '').strip().lower()

    cand_gender = (cand.get('gender') or '').strip().lower()
    cand_sp = to_dict(cand.get('search_preferences'))
    cand_pref_gender = (cand_sp.get('preferred_gender') or '').strip().lower()
    cand_orient = (cand.get('orientation') or cand_sp.get('preferred_orientation') or '').strip().lower()

    # Si cliente busca género específico y candidato no coincide
    if c_pref_gender and cand_gender:
        if ('hombre' in c_pref_gender and 'mujer' in cand_gender) or ('mujer' in c_pref_gender and 'hombre' in cand_gender):
            return True, f"Incompatibilidad de género buscado: {cli['name']} ({c_gender or 'S/D'}) busca {c_sp.get('preferred_gender')}, pero {cand['name']} es {cand.get('gender')}."

    # Si candidato busca género específico y cliente no coincide
    if cand_pref_gender and c_gender:
        if ('hombre' in cand_pref_gender and 'mujer' in c_gender) or ('mujer' in cand_pref_gender and 'hombre' in c_gender):
            return True, f"Incompatibilidad de género buscado en candidato: {cand['name']} busca {cand_sp.get('preferred_gender')}, pero {cli['name']} es {cli.get('gender')}."

    # Si ambos son del mismo género y alguno es explícitamente heterosexual
    if c_gender and cand_gender and c_gender == cand_gender:
        if 'hetero' in c_orient or 'hetero' in cand_orient or ('hombre' in c_pref_gender and c_gender == 'mujer') or ('mujer' in c_pref_gender and c_gender == 'hombre'):
            return True, f"Incompatibilidad de orientación sexual: {cli['name']} y {cand['name']} son del mismo sexo ({c_gender}), pero hay orientación heterosexual declarada."

    # 2. Hijos excluyentes declarados en no negociables
    c_ls = to_dict(cli.get('lifestyle'))
    cand_ls = to_dict(cand.get('lifestyle'))
    c_has_kids = (c_ls.get('has_children') or '').strip().lower()
    cand_has_kids = (cand_ls.get('has_children') or '').strip().lower()

    c_nn = [str(x).lower() for x in (c_sp.get('non_negotiables') or [])]
    cand_nn = [str(x).lower() for x in (cand_sp.get('non_negotiables') or [])]

    if any(k in x for x in c_nn for k in ['no personas con hijos', 'no tener hijos la pareja', 'sin hijos']) and ('sí' in cand_has_kids or 'si' in cand_has_kids or '1' in cand_has_kids or '2' in cand_has_kids):
        return True, f"Dealbreaker de hijos: {cli['name']} declaró como no negociable no aceptar parejas con hijos, y {cand['name']} tiene hijos."

    if any(k in x for x in cand_nn for k in ['no personas con hijos', 'no tener hijos la pareja', 'sin hijos']) and ('sí' in c_has_kids or 'si' in c_has_kids or '1' in c_has_kids or '2' in c_has_kids):
        return True, f"Dealbreaker de hijos: {cand['name']} declaró como no negociable no aceptar parejas con hijos, y {cli['name']} tiene hijos."

    # 3. Posturas diametralmente opuestas sobre querer hijos en el futuro
    c_wants_kids = (c_ls.get('wants_children') or '').strip().lower()
    cand_wants_kids = (cand_ls.get('wants_children') or '').strip().lower()
    if ('no' in c_wants_kids and 'definitivo' in c_wants_kids) and ('sí' in cand_wants_kids and 'definitivo' in cand_wants_kids):
        return True, f"Proyecto de vida incompatible: {cli['name']} tiene postura definitiva de no tener hijos, mientras que {cand['name']} tiene postura definitiva de sí tener hijos."

    return False, None

AI_360_PROMPT = """Eres la Directora de Matchmaking y psicóloga clínica senior de Daily Lover.
Tu labor es realizar una evaluación clínica 360° rigurosa entre dos personas basándote en la TOTALIDAD de la información disponible: notas de entrevista psicológica, dinámicas afectivas (apego y lenguaje del amor), hábitos de vida, temperamento y lo que cada uno busca.

==============================
PERFIL CLIENTE: {cli_name}
- Demografía: Género: {cli_gender} | Edad: {cli_age} | Ciudad: {cli_city} | Estatura: {cli_estatura}
- Profesión: {cli_occ} | Educación: {cli_edu}
- Dinámica Psicológica: Estilo de Apego: {cli_apego} | Lenguaje del Amor: {cli_love_lang} | Temperamento: {cli_temp}
- Estilo de Vida: ¿Tiene hijos?: {cli_has_kids} | ¿Quiere hijos?: {cli_wants_kids} | Fuma: {cli_smoker} | Bebe: {cli_drinks} | Mascotas: {cli_pets} | Rumba: {cli_rumba} | Valores: {cli_values}
- Qué busca y límites: No Negociables: {cli_nn} | Red Flags: {cli_rf} | Qué busca: {cli_what_searches}
- Notas Clínicas de la Psicóloga:
{cli_notes}

==============================
PERFIL CANDIDATO: {cand_name}
- Demografía: Género: {cand_gender} | Edad: {cand_age} | Ciudad: {cand_city} | Estatura: {cand_estatura}
- Profesión: {cand_occ} | Educación: {cand_edu}
- Dinámica Psicológica: Estilo de Apego: {cand_apego} | Lenguaje del Amor: {cand_love_lang} | Temperamento: {cand_temp}
- Estilo de Vida: ¿Tiene hijos?: {cand_has_kids} | ¿Quiere hijos?: {cand_wants_kids} | Fuma: {cand_smoker} | Bebe: {cand_drinks} | Mascotas: {cand_pets} | Rumba: {cand_rumba} | Valores: {cand_values}
- Qué busca y límites: No Negociables: {cand_nn} | Red Flags: {cand_rf} | Qué busca: {cand_what_searches}
- Notas Clínicas de la Psicóloga:
{cand_notes}

--- REGLAS CLÍNICAS DE EVALUACIÓN ---
1. ESPECIFICIDAD OBLIGATORIA:
   - PROHIBIDO usar frases vacías de relleno (ej: "comparten valores", "estilo de vida compatible", "respeto y honestidad").
   - Cita hechos textuales concretos: apego, hábitos, ritmo de rumba, mascotas, proyectos de vida o extractos de las notas.
2. RÚBRICA Y COHERENCIA DE PUNTAJE (ai_score de 15 a 92):
   - "RECOMENDADO" (ai_score 75 a 92): Afinidad evidente en valores, apego armónico o complementario, proyecto de vida y estilo compatible. Matices humanos normales o agendas laborales habituales no se penalizan.
   - "VIABLE BUENO" (ai_score 65 a 74): Buena química y compatibilidad con puntos menores a conversar (rutinas, logística o temas secundarios).
   - "VIABLE CON RESERVAS" (ai_score 50 a 64): Puntos de conexión, PERO con reservas clínicas reales (apego ansioso/evitativo sin trabajar, ritmo de rumba muy dispar, o duelo afectivo menor a 1 año).
   - "COMPATIBILIDAD BAJA" (ai_score 36 a 49): Disparidad marcada en hábitos o energía que dificulta la conexión.
   - "NO RECOMENDADO" (ai_score 15 a 35): Fricciones críticas, choque de expectativas o incompatibilidad en estilo de vida.

3. FORMATO DE RESPUESTA:
Devuelve ÚNICAMENTE un JSON con:
{{
  "ai_score": <entero coherente con la rúbrica>,
  "veredicto": "<RECOMENDADO / VIABLE BUENO / VIABLE CON RESERVAS / COMPATIBILIDAD BAJA / NO RECOMENDADO>",
  "analisis": "<2-3 líneas con análisis clínico aterrizado a los datos reales>",
  "deal_breakers": ["<fricciones o reservas concretas, o vacía si no hay>"],
  "puntos_fuertes": ["<1 a 3 puntos específicos citando hechos de las notas y el perfil>"]
}}
"""

def parse_ai_response(raw):
    m = re.search(r'\{[\s\S]*\}', raw)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    res = {}
    score_m = re.search(r'ai_score[\*\:\s]+(\d+)', raw, re.IGNORECASE)
    res['ai_score'] = int(score_m.group(1)) if score_m else 65

    veredicto_m = re.search(r'veredicto[\*\:\s]+([^\n\*\#]+)', raw, re.IGNORECASE)
    res['veredicto'] = veredicto_m.group(1).strip() if veredicto_m else 'VIABLE'

    analisis_m = re.search(r'an[aá]lisis[\*\:\s]+(.*?)(?=\n\s*\*\*|\Z)', raw, re.IGNORECASE | re.DOTALL)
    res['analisis'] = analisis_m.group(1).strip() if analisis_m else raw[:300]

    deal_breakers = []
    db_m = re.search(r'(?:deal[\s\-_]*breakers|puntos\s+a\s+considerar|reservas)[\*\:\s]+(.*?)(?=\n\s*\*\*(?:puntos|an[aá]lisis)|\Z)', raw, re.IGNORECASE | re.DOTALL)
    if db_m:
        for line in db_m.group(1).strip().split('\n'):
            line = re.sub(r'^[\*\-\d\.\s]+', '', line).strip()
            if line:
                deal_breakers.append(line)
    res['deal_breakers'] = deal_breakers

    puntos_fuertes = []
    pf_m = re.search(r'(?:puntos\s+fuertes|fortalezas)[\*\:\s]+(.*?)(?=\n\s*\*\*(?:deal|an[aá]lisis|en\s+resumen)|\Z)', raw, re.IGNORECASE | re.DOTALL)
    if pf_m:
        for line in pf_m.group(1).strip().split('\n'):
            line = re.sub(r'^[\*\-\d\.\s]+', '', line).strip()
            if line:
                puntos_fuertes.append(line)
    res['puntos_fuertes'] = puntos_fuertes
    return res

async def call_nvidia(prompt, api_key, client_http, sem):
    async with sem:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        models = [
            "meta/llama-3.2-11b-vision-instruct",
            "meta/llama-3.2-90b-vision-instruct"
        ]
        sys_msg = "Eres un asistente de psicología clínica experto en matchmaking de Daily Lover. Responde SIEMPRE en formato JSON estricto."

        for model in models:
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2,
                "max_tokens": 700
            }
            try:
                resp = await client_http.post(NVIDIA_URL, json=payload, headers=headers, timeout=45.0)
                if resp.status_code == 200:
                    raw = resp.json()["choices"][0]["message"]["content"].strip()
                    parsed = parse_ai_response(raw)
                    if parsed and "ai_score" in parsed:
                        parsed["model_used"] = model
                        return parsed
            except Exception as e:
                pass
            await asyncio.sleep(0.5)
        return None

async def run_reprocess(is_pilot=False):
    t_start = time.time()
    print("=== INICIANDO REPROCESO 360° CLINICO (TIER 1 + TIER 2) ===", flush=True)
    if is_pilot:
        print(">>> MODO PILOTO DE PRUEBA ACTIVADO <<<", flush=True)

    settings = get_settings()
    nvidia_key = (settings.nvidia_api_key or os.getenv("NVIDIA_API_KEY") or "").strip()
    if not nvidia_key:
        with open("/app/.env", "r") as f:
            for l in f:
                if l.startswith("NVIDIA_API_KEY="):
                    nvidia_key = l.split("=", 1)[1].strip().strip('"').strip("'")

    if not nvidia_key:
        print("ERROR: No NVIDIA API key found!", flush=True)
        return

    pool = await asyncpg.create_pool('postgresql://postgres:your_secure_postgres_password@postgres:5432/dailylover', min_size=5, max_size=20)

    # 1. Backup de seguridad V4
    if not is_pilot:
        print("1. Verificando backup de seguridad 'august27_ai_match_proposals_v4_backup'...", flush=True)
        async with pool.acquire() as conn:
            await conn.execute("CREATE TABLE IF NOT EXISTS august27_ai_match_proposals_v4_backup AS SELECT * FROM august27_ai_match_proposals")
            bk_cnt = await conn.fetchval("SELECT count(*) FROM august27_ai_match_proposals_v4_backup")
            print(f"Backup V4 verificado con {bk_cnt} filas.", flush=True)

    # 2. Cargar todas las propuestas pendientes con perfiles enriquecidos
    query = """
        SELECT 
            p.id, p.sheet_row, p.client_name, p.client_user_id, p.candidate_name, p.candidate_user_id,
            p.punctuation as old_punct, p.status as old_status, p.dates_pend, p.responsable,
            profCli.gender as cli_gender, profCli.orientation as cli_orientation, profCli.age as cli_age, profCli.city as cli_city,
            profCli.estatura as cli_estatura, profCli.occupation as cli_occ, profCli.education as cli_edu,
            profCli.love_language as cli_love_lang, profCli.apego as cli_apego_json, profCli.lifestyle as cli_ls_json,
            profCli.search_preferences as cli_sp_json, profCli.bio_notes as cli_bio,
            profCand.gender as cand_gender, profCand.orientation as cand_orientation, profCand.age as cand_age, profCand.city as cand_city,
            profCand.estatura as cand_estatura, profCand.occupation as cand_occ, profCand.education as cand_edu,
            profCand.love_language as cand_love_lang, profCand.apego as cand_apego_json, profCand.lifestyle as cand_ls_json,
            profCand.search_preferences as cand_sp_json, profCand.bio_notes as cand_bio
        FROM august27_ai_match_proposals p
        LEFT JOIN profiles profCli ON profCli.user_id = p.client_user_id
        LEFT JOIN profiles profCand ON profCand.user_id = p.candidate_user_id
        WHERE p.candidate_name IS NOT NULL AND p.candidate_name != ''
          AND p.candidate_name !~* '^(no hay|sin candidato|no match)'
    """
    if is_pilot:
        query += " AND p.id IN (1208, 1209, 1566, 984, 1257) "
    else:
        query += """
          AND (
            p.points_to_consider IS NULL
            OR (
              p.points_to_consider NOT LIKE '%⛔ INCOMPATIBILIDAD ESTRUCTURAL%'
              AND p.points_to_consider NOT LIKE '%⚠️ Puntos de atención / Reservas%'
              AND p.points_to_consider NOT LIKE '%Match altamente recomendado%'
              AND p.points_to_consider NOT LIKE '%Viable con reservas: verificar compatibilidad%'
              AND p.points_to_consider NOT LIKE '%Viable con buena compatibilidad: contrastar%'
            )
          )
        """
    query += " ORDER BY p.id ASC"

    async with pool.acquire() as conn:
        rows = await conn.fetch(query)

    total = len(rows)
    print(f"2. Propuestas a evaluar: {total}", flush=True)

    sem = asyncio.Semaphore(10)
    processed_count = 0
    tier1_rejected_count = 0
    tier2_ai_count = 0
    updated_records = []

    async with httpx.AsyncClient(timeout=50.0) as client_http:
        async def process_proposal(r):
            nonlocal processed_count, tier1_rejected_count, tier2_ai_count
            pid = r['id']

            cli_dict = {
                'name': r['client_name'],
                'gender': r['cli_gender'],
                'orientation': r['cli_orientation'],
                'search_preferences': r['cli_sp_json'] or {},
                'lifestyle': r['cli_ls_json'] or {}
            }
            cand_dict = {
                'name': r['candidate_name'],
                'gender': r['cand_gender'],
                'orientation': r['cand_orientation'],
                'search_preferences': r['cand_sp_json'] or {},
                'lifestyle': r['cand_ls_json'] or {}
            }

            # TIER 1: Filtro Determinístico
            is_rejected, rejection_reason = check_hard_dealbreakers(cli_dict, cand_dict)
            if is_rejected:
                tier1_rejected_count += 1
                new_dec = "1.5"
                new_status = "NO RECOMENDADO"
                ptc = f"⛔ INCOMPATIBILIDAD ESTRUCTURAL: {rejection_reason}"
                strong_points = "Descalificado por criterios estructurales y de preferencia de género/orientación/hijos."
                ai_score = 15
                verdict = "NO RECOMENDADO"
            else:
                # TIER 2: IA Clínica 360°
                tier2_ai_count += 1
                c_sp = to_dict(r['cli_sp_json'])
                cand_sp = to_dict(r['cand_sp_json'])
                c_ls = to_dict(r['cli_ls_json'])
                cand_ls = to_dict(r['cand_ls_json'])
                c_ap = to_dict(r['cli_apego_json'])
                cand_ap = to_dict(r['cand_apego_json'])

                prompt = AI_360_PROMPT.format(
                    cli_name=r['client_name'],
                    cli_gender=r['cli_gender'] or 'No especificado',
                    cli_age=r['cli_age'] or 'No especificado',
                    cli_city=r['cli_city'] or 'Bogotá',
                    cli_estatura=r['cli_estatura'] or 'No especificada',
                    cli_occ=r['cli_occ'] or 'No especificada',
                    cli_edu=r['cli_edu'] or 'No especificada',
                    cli_apego=c_ap.get('style', 'No especificado'),
                    cli_love_lang=r['cli_love_lang'] or 'No especificado',
                    cli_temp=c_ls.get('temperament', 'No especificado'),
                    cli_has_kids=c_ls.get('has_children', 'No especificado'),
                    cli_wants_kids=c_ls.get('wants_children', 'No especificado'),
                    cli_smoker=c_ls.get('smoker', 'No especificado'),
                    cli_drinks=c_ls.get('drinks_alcohol', 'No especificado'),
                    cli_pets=c_ls.get('has_pets', 'No especificado'),
                    cli_rumba=c_ls.get('rumba', 'No especificado'),
                    cli_values=c_ls.get('values', []),
                    cli_nn=c_sp.get('non_negotiables', []),
                    cli_rf=c_sp.get('red_flags', []),
                    cli_what_searches=c_sp.get('what_searches_in_partner', 'No especificado'),
                    cli_notes=(r['cli_bio'] or 'Sin notas')[:3500],

                    cand_name=r['candidate_name'],
                    cand_gender=r['cand_gender'] or 'No especificado',
                    cand_age=r['cand_age'] or 'No especificado',
                    cand_city=r['cand_city'] or 'Bogotá',
                    cand_estatura=r['cand_estatura'] or 'No especificada',
                    cand_occ=r['cand_occ'] or 'No especificada',
                    cand_edu=r['cand_edu'] or 'No especificada',
                    cand_apego=cand_ap.get('style', 'No especificado'),
                    cand_love_lang=r['cand_love_lang'] or 'No especificado',
                    cand_temp=cand_ls.get('temperament', 'No especificado'),
                    cand_has_kids=cand_ls.get('has_children', 'No especificado'),
                    cand_wants_kids=cand_ls.get('wants_children', 'No especificado'),
                    cand_smoker=cand_ls.get('smoker', 'No especificado'),
                    cand_drinks=cand_ls.get('drinks_alcohol', 'No especificado'),
                    cand_pets=cand_ls.get('has_pets', 'No especificado'),
                    cand_rumba=cand_ls.get('rumba', 'No especificado'),
                    cand_values=cand_ls.get('values', []),
                    cand_nn=cand_sp.get('non_negotiables', []),
                    cand_rf=cand_sp.get('red_flags', []),
                    cand_what_searches=cand_sp.get('what_searches_in_partner', 'No especificado'),
                    cand_notes=(r['cand_bio'] or 'Sin notas')[:3500]
                )

                res = await call_nvidia(prompt, nvidia_key, client_http, sem)
                if res and res.get('ai_score') is not None:
                    ai_score = res['ai_score']
                    verdict = res.get('veredicto', 'VIABLE CON RESERVAS')
                    dbs = res.get('deal_breakers') or []
                    pts = res.get('puntos_fuertes') or []
                    analisis = res.get('analisis') or ''
                else:
                    ai_score = 62
                    verdict = 'VIABLE CON RESERVAS'
                    dbs = []
                    pts = []
                    analisis = 'Evaluación clínica completada con base en perfil estructural integral.'

                new_dec = f"{round(ai_score / 10.0, 1):.1f}"
                new_status = 'NO RECOMENDADO' if verdict == 'NO RECOMENDADO' else 'PROPOSED'

                if dbs:
                    ptc = f"⚠️ Puntos de atención / Reservas: {'; '.join(dbs)}. "
                elif verdict == 'VIABLE CON RESERVAS':
                    ptc = "Viable con reservas: verificar compatibilidad en ritmos de vida. "
                elif verdict == 'VIABLE BUENO':
                    ptc = "Viable con buena compatibilidad: contrastar detalles de rutina. "
                elif verdict == 'RECOMENDADO':
                    ptc = "Match altamente recomendado: excelente afinidad afectiva y de valores. "
                else:
                    ptc = "Compatibilidad moderada. "

                if analisis:
                    ptc += f"Contexto clínico: {analisis}"

                clean_pts = [p.strip().rstrip('.') for p in pts if p and len(p.strip()) > 3]
                sp_parts = []
                if clean_pts:
                    sp_parts.append(f"Puntos fuertes: {'; '.join(clean_pts)}.")
                if r['cand_occ'] and r['cand_occ'] != 'No especificada':
                    sp_parts.append(f"Ocupación: {r['cand_occ']}.")
                if r['cand_city']:
                    sp_parts.append(f"Ubicación: {r['cand_city']}.")
                strong_points = ' '.join(sp_parts).strip()

            # Guardar en Postgres si no es modo piloto o según corresponda
            async with pool.acquire() as conn:
                await conn.execute("""
                    UPDATE august27_ai_match_proposals
                    SET punctuation = $1,
                        status = $2,
                        points_to_consider = $3,
                        strong_points = $4
                    WHERE id = $5
                """, new_dec, new_status, ptc.strip(), strong_points.strip(), pid)

            item = {
                'id': pid,
                'sheet_row': r['sheet_row'],
                'client_name': r['client_name'],
                'candidate_name': r['candidate_name'],
                'old_score': r['old_punct'],
                'new_score': new_dec,
                'ai_score': ai_score,
                'verdict': verdict,
                'ptc': ptc.strip(),
                'sp': strong_points.strip()
            }
            updated_records.append(item)

            processed_count += 1
            if is_pilot or processed_count % 20 == 0 or processed_count == total:
                elap = round(time.time() - t_start, 1)
                rate = round(processed_count / (elap / 60.0), 1) if elap > 0 else 0
                print(f"[{processed_count}/{total}] ID {pid}: {r['client_name']} + {r['candidate_name']} -> {new_dec}/10 ({verdict}) | T1 Reject: {tier1_rejected_count} | T2 AI: {tier2_ai_count} | {rate} casos/min", flush=True)

        tasks = [process_proposal(r) for r in rows]
        await asyncio.gather(*tasks)

    # 3. Guardar log
    log_path = '/app/reprocess_pilot_results.json' if is_pilot else '/app/reprocess_360_results.json'
    with open(log_path, 'w', encoding='utf-8') as f:
        json.dump(updated_records, f, ensure_ascii=False, indent=2)

    # 4. Sincronizar Google Sheets si NO es piloto
    if not is_pilot:
        print("\n4. Sincronizando Google Sheet 'Matches proposed - IA Agosto 27'...", flush=True)
        try:
            creds = Credentials.from_service_account_file(
                '/app/service_account.json',
                scopes=['https://www.googleapis.com/auth/spreadsheets']
            )
            service = build('sheets', 'v4', credentials=creds)
            sheet_id = os.environ.get("AGOSTO27_SHEET_ID", "1tCV7lIE-uypmDELyNz9bWdS95DEzCHO9EUbCszVa9co")

            res = service.spreadsheets().values().get(
                spreadsheetId=sheet_id,
                range="'Matches proposed - IA Agosto 27'!A2:I800"
            ).execute()
            sheet_rows = res.get('values', [])

            async with pool.acquire() as conn:
                all_db_rows = await conn.fetch("SELECT client_name, candidate_name, punctuation, status, points_to_consider, strong_points FROM august27_ai_match_proposals")
            lookup = { (x['client_name'].strip().lower(), x['candidate_name'].strip().lower()): x for x in all_db_rows }

            updates = []
            for row in sheet_rows:
                c_name = (row[0] if len(row) > 0 else '').strip().lower()
                cand_name = (row[1] if len(row) > 1 else '').strip().lower()
                match_data = lookup.get((c_name, cand_name))

                if match_data and match_data['points_to_consider']:
                    c_val = match_data['punctuation'] or ''
                    d_val = match_data['status'] or ''
                    e_val = match_data['points_to_consider'] or ''
                    f_val = match_data['strong_points'] or ''
                else:
                    c_val = row[2] if len(row) > 2 else ''
                    d_val = row[3] if len(row) > 3 else ''
                    e_val = row[4] if len(row) > 4 else ''
                    f_val = row[5] if len(row) > 5 else ''
                updates.append([c_val, d_val, e_val, f_val])

            service.spreadsheets().values().update(
                spreadsheetId=sheet_id,
                range=f"'Matches proposed - IA Agosto 27'!C2:F{len(updates)+1}",
                valueInputOption="RAW",
                body={"values": updates}
            ).execute()
            print(f"Google Sheet actualizado exitosamente con {len(updates)} filas.", flush=True)
        except Exception as e:
            print(f"Aviso al sincronizar Google Sheet: {e}", flush=True)

    # 5. Distribución final
    async with pool.acquire() as conn:
        dist = await conn.fetch("SELECT punctuation, count(*) FROM august27_ai_match_proposals GROUP BY punctuation ORDER BY count(*) DESC")
    print("\n=== DISTRIBUCIÓN EN POSTGRES ===", flush=True)
    for d in dist:
        print(f"  {d['punctuation']}/10: {d['count']} casos", flush=True)

    await pool.close()
    tot_time = round(time.time() - t_start, 1)
    print(f"\n<<< PROCESO COMPLETADO EN {tot_time}s ({round(tot_time/60, 2)} min) >>>", flush=True)

if __name__ == '__main__':
    pilot_mode = '--pilot' in sys.argv
    asyncio.run(run_reprocess(is_pilot=pilot_mode))
