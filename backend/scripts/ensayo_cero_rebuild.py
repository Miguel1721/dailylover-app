#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ensayo Cero de Reconstrucción de Base de Datos Operativa (dailylover_ensayo)
========================================================================
SOLO sobre base de datos copia: dailylover_ensayo.
CERO escritura sobre producción.
Alcance de Google Sheets: spreadsheets.readonly.

Guarda:
- FECHA -> created_at (fecha real del match)
- APRO DATE -> approved_at
- ÉL -> scheduled_dates.feedback_el
- ELLA -> scheduled_dates.feedback_ella
- MATCH -> scheduled_dates.match_result (yes/no/friends/maybe)
- Presupuesto -> scheduled_dates.budget
- PAIS -> operational_matches.pais
- TROUBLE DATE -> trouble_matches.created_at
- Tablas de archivo: Corazoncito, VOLVIO A PAGAR (recompras), ENAMORADOS
"""

import sys
import os
import json
import time
import re
import asyncio
from datetime import datetime, timezone
import unicodedata
import asyncpg
from google.oauth2 import service_account
from googleapiclient.discovery import build

SHEET_ID = "113GBaGwDltILH4pMqbyvuK17rhCIxPFW0Cv4sLtBX5A"
CREDS_FILE = "/app/service_account.json"
TARGET_DB = "dailylover_ensayo"
DB_HOST = "dl_postgres"
DB_PORT = 5432
DB_USER = "postgres"
DB_PASS = "your_secure_postgres_password"

MONTHS_ES = {
    "ene": 1, "enero": 1,
    "feb": 2, "febrero": 2,
    "mar": 3, "marzo": 3,
    "abr": 4, "abril": 4,
    "may": 5, "mayo": 5,
    "jun": 6, "junio": 6,
    "jul": 7, "julio": 7,
    "ago": 8, "agosto": 8,
    "sep": 9, "sept": 9, "septiembre": 9,
    "oct": 10, "octubre": 10,
    "nov": 11, "noviembre": 11,
    "dic": 12, "diciembre": 12
}

STATUS_MAPPING = {
    "APROBADO": "APROBADO",
    "APROBADA": "APROBADO",
    "APROBADO POR MARIA": "APROBADO",
    "NOT APPROVED": "NOT APPROVED",
    "NO ACCEPT": "NOT APPROVED",
    "RECHAZADO": "NOT APPROVED",
    "RECHAZADA": "NOT APPROVED",
    "TROUBLE": "TROUBLE",
    "TROUBLEMAKER": "TROUBLE",
    "HECHO POR MAPE": "HECHO POR MAPE",
    "HECHO POR SILVI": "HECHO POR SILVI",
    "HECHO POR STEFF": "HECHO POR STEFF",
    "HECHO POR ALEJA": "HECHO POR ALEJA",
    "HECHO POR ANA": "HECHO POR ANA",
    "HECHO POR JENN": "HECHO POR JENN",
    "HECHO POR SOFI": "HECHO POR SOFI",
    "HECHO POR LAU": "HECHO POR LAU",
    "HECHO POR ISA": "HECHO POR ISA",
    "HECHO POR MANU": "HECHO POR MANU",
    "HECHO POR PIA": "HECHO POR PIA",
    "HECHO POR CS": "HECHO POR CS",
    "HECHO POR MARIA": "HECHO POR MARIA",
    "PENDIENTE": "PENDIENTE",
    "STAND BY": "STAND BY",
    "STAND BY ": "STAND BY",
    "SE CANCELA": "CANCELADO",
    "CANCELADO": "CANCELADO",
    "CANCELADA": "CANCELADO",
    "PAUSADO": "STAND BY",
    "NO CONTESTA": "NO CONTESTA",
    "NO RESPONDE": "NO CONTESTA",
    "PIDIO REFOUND": "REFUND",
    "REFOUND": "REFUND",
    "REFUND": "REFUND"
}

def parse_date(date_str):
    if not date_str or not str(date_str).strip():
        return None
    s = str(date_str).strip().lower()

    # Formatos estándar: DD/MM/YYYY, YYYY-MM-DD
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass

    # Formatos de 3 partes con regex
    m3 = re.search(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})", s)
    if m3:
        d, mth, y = m3.groups()
        if len(y) == 2:
            y = "20" + y
        try:
            return datetime(int(y), int(mth), int(d))
        except ValueError:
            pass

    # Formato DD/MM (ej: 11/06, 15/09, 4.29)
    m2 = re.match(r"^(\d{1,2})[/.-](\d{1,2})$", s)
    if m2:
        d, mth = m2.groups()
        try:
            # En Colombia el formato es DD/MM
            d_i, m_i = int(d), int(mth)
            if 1 <= m_i <= 12 and 1 <= d_i <= 31:
                return datetime(2026, m_i, d_i)
        except ValueError:
            pass

    # Formato texto: "mayo 4", "4 mayo", "02 sep", "15 sep", "8/20"
    for m_name, m_num in MONTHS_ES.items():
        if m_name in s:
            day_match = re.search(r"\b(\d{1,2})\b", s)
            if day_match:
                try:
                    return datetime(2026, m_num, int(day_match.group(1)))
                except ValueError:
                    pass

    return None

def normalize_text(text):
    if not text:
        return ""
    text = unicodedata.normalize('NFKD', str(text)).encode('ASCII', 'ignore').decode('utf-8')
    return re.sub(r'\s+', ' ', text).strip().upper()

async def main():
    print("=" * 80)
    print("ENSAYO CERO: RECONSTRUCCIÓN SOBRE dailylover_ensayo")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 80)

    # 1. Seguridad estricta
    if TARGET_DB != "dailylover_ensayo":
        print(f"[FATAL] La base de datos configurada es {TARGET_DB}. DEBE ser dailylover_ensayo.")
        sys.exit(1)

    # 2. Conectar a PostgreSQL dailylover_ensayo
    conn = await asyncpg.connect(
        database=TARGET_DB,
        user=DB_USER,
        password=DB_PASS,
        host=DB_HOST,
        port=DB_PORT
    )

    curr_db = await conn.fetchval("SELECT current_database();")
    if curr_db != "dailylover_ensayo":
        print(f"[FATAL] Conectado a {curr_db} en lugar de dailylover_ensayo. ABORTANDO.")
        await conn.close()
        sys.exit(1)
    print(f"[OK] Conectado con éxito a base de ensayo: {curr_db}")

    # 3. Conectar a Google Sheets (readonly)
    creds = service_account.Credentials.from_service_account_file(
        CREDS_FILE,
        scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
    )
    service = build('sheets', 'v4', credentials=creds)
    sheets_api = service.spreadsheets()

    # 4. Crear tablas de respaldo dentro de dailylover_ensayo si no existen
    print("\n--- PASO 1: Creando respaldos pre-corte en dailylover_ensayo ---")
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS operational_matches_pre_corte_20261001 AS SELECT * FROM operational_matches;
        CREATE TABLE IF NOT EXISTS scheduled_dates_pre_corte_20261001 AS SELECT * FROM scheduled_dates;
        CREATE TABLE IF NOT EXISTS trouble_matches_pre_corte_20261001 AS SELECT * FROM trouble_matches;
    """)
    print("[OK] Tablas de respaldo verificadas.")

    # 5. Agregar columnas nuevas si faltan y ensanchar varchars
    print("\n--- PASO 2: Verificando columnas de destino ---")
    await conn.execute("""
        ALTER TABLE operational_matches ADD COLUMN IF NOT EXISTS pais text;
        ALTER TABLE scheduled_dates ADD COLUMN IF NOT EXISTS match_result text;
        ALTER TABLE scheduled_dates ADD COLUMN IF NOT EXISTS budget text;

        ALTER TABLE trouble_matches ALTER COLUMN reported_by TYPE text;
        ALTER TABLE trouble_matches ALTER COLUMN person_a TYPE text;
        ALTER TABLE trouble_matches ALTER COLUMN person_b TYPE text;
        ALTER TABLE trouble_matches ALTER COLUMN venue TYPE text;

        ALTER TABLE scheduled_dates ALTER COLUMN person_a TYPE text;
        ALTER TABLE scheduled_dates ALTER COLUMN person_b TYPE text;

        ALTER TABLE operational_matches ALTER COLUMN person_a TYPE text;
        ALTER TABLE operational_matches ALTER COLUMN person_b TYPE text;
    """)
    print("[OK] Columnas pais, match_result, budget listas y varchars ensanchados.")

    # 6. Crear tablas de archivo para Corazoncito, VOLVIO A PAGAR y ENAMORADOS
    print("\n--- PASO 3: Creando y poblando tablas de archivo ---")
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS sheet_corazoncito_archive (
            id SERIAL PRIMARY KEY,
            sheet_row_index integer,
            ticket_date text,
            person text,
            cs_comment text,
            match_candidate text,
            psychologist text,
            match_date text,
            mm_comment text,
            status text,
            notes text,
            archived_at timestamp default now()
        );

        CREATE TABLE IF NOT EXISTS sheet_recompras_archive (
            id SERIAL PRIMARY KEY,
            sheet_row_index integer,
            psychologist text,
            person text,
            reason text,
            payment_date text,
            notes_1 text,
            notes_2 text,
            archived_at timestamp default now()
        );

        CREATE TABLE IF NOT EXISTS sheet_enamorados_archive (
            id SERIAL PRIMARY KEY,
            sheet_row_index integer,
            person_a text,
            person_b text,
            time_in_love text,
            match_date text,
            matchmaker text,
            notes text,
            archived_at timestamp default now()
        );

        TRUNCATE TABLE sheet_corazoncito_archive, sheet_recompras_archive, sheet_enamorados_archive;
    """)

    # Cargar Corazoncito
    res_cor = sheets_api.values().get(spreadsheetId=SHEET_ID, range="Corazoncito!A2:I500").execute()
    cor_rows = res_cor.get("values", [])
    cor_inserts = []
    for r_idx, row in enumerate(cor_rows, start=2):
        if not any(row): continue
        cor_inserts.append((
            r_idx,
            row[0] if len(row) > 0 else None,
            row[1] if len(row) > 1 else None,
            row[2] if len(row) > 2 else None,
            row[3] if len(row) > 3 else None,
            row[4] if len(row) > 4 else None,
            row[5] if len(row) > 5 else None,
            row[6] if len(row) > 6 else None,
            row[7] if len(row) > 7 else None,
            row[8] if len(row) > 8 else None
        ))
    if cor_inserts:
        await conn.executemany("""
            INSERT INTO sheet_corazoncito_archive 
            (sheet_row_index, ticket_date, person, cs_comment, match_candidate, psychologist, match_date, mm_comment, status, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        """, cor_inserts)
    print(f"   ✓ sheet_corazoncito_archive: {len(cor_inserts)} registros guardados")

    # Cargar VOLVIO A PAGAR (Recompras)
    res_rec = sheets_api.values().get(spreadsheetId=SHEET_ID, range="VOLVIO A PAGAR!A2:F300").execute()
    rec_rows = res_rec.get("values", [])
    rec_inserts = []
    for r_idx, row in enumerate(rec_rows, start=2):
        if not any(row): continue
        rec_inserts.append((
            r_idx,
            row[0] if len(row) > 0 else None,
            row[1] if len(row) > 1 else None,
            row[2] if len(row) > 2 else None,
            row[3] if len(row) > 3 else None,
            row[4] if len(row) > 4 else None,
            row[5] if len(row) > 5 else None
        ))
    if rec_inserts:
        await conn.executemany("""
            INSERT INTO sheet_recompras_archive
            (sheet_row_index, psychologist, person, reason, payment_date, notes_1, notes_2)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, rec_inserts)
    print(f"   ✓ sheet_recompras_archive: {len(rec_inserts)} registros guardados")

    # Cargar ENAMORADOS
    res_enam = sheets_api.values().get(spreadsheetId=SHEET_ID, range="ENAMORADOS!A2:F150").execute()
    enam_rows = res_enam.get("values", [])
    enam_inserts = []
    for r_idx, row in enumerate(enam_rows, start=2):
        if not any(row): continue
        enam_inserts.append((
            r_idx,
            row[0] if len(row) > 0 else None,
            row[1] if len(row) > 1 else None,
            row[2] if len(row) > 2 else None,
            row[3] if len(row) > 3 else None,
            row[4] if len(row) > 4 else None,
            row[5] if len(row) > 5 else None
        ))
    if enam_inserts:
        await conn.executemany("""
            INSERT INTO sheet_enamorados_archive
            (sheet_row_index, person_a, person_b, time_in_love, match_date, matchmaker, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, enam_inserts)
    print(f"   ✓ sheet_enamorados_archive: {len(enam_inserts)} registros guardados")

    # 7. Indexar usuarios en memoria
    print("\n--- PASO 4: Indexando usuarios existentes en BD ---")
    user_rows = await conn.fetch("SELECT id, name, client_code FROM users;")
    users_by_norm = {}
    for u in user_rows:
        n = normalize_text(u["name"])
        if n and n not in users_by_norm:
            users_by_norm[n] = u["id"]
    print(f"[OK] {len(users_by_norm)} usuarios indexados por nombre.")

    # 8. Vaciar tablas operativas para reconstrucción pura
    print("\n--- PASO 5: Truncando tablas operativas en dailylover_ensayo ---")
    await conn.execute("TRUNCATE TABLE operational_matches, scheduled_dates, trouble_matches CASCADE;")
    print("[OK] operational_matches, scheduled_dates y trouble_matches vaciadas.")

    # 9. Reconstrucción desde las 11 pestañas de psicólogas
    print("\n--- PASO 6: Reconstruyendo operational_matches desde la hoja ---")
    meta = sheets_api.get(spreadsheetId=SHEET_ID).execute()
    all_titles = {s['properties']['title'].strip(): s['properties']['title'] for s in meta['sheets']}
    print(f"[OK] {len(all_titles)} pestañas detectadas en Google Sheet.")

    total_om_inserted = 0
    stats_by_psyc = {}

    target_psychologists = [
        ("JENN", ["MATCHES JENN", "JENN"]),
        ("SILVI", ["MATCHES SILVI", "SILVI"]),
        ("ANA", ["MATCHES ANA", "ANA", "MATCHES ANA "]),
        ("STEFFY", ["MATCHES STEFFY", "STEFFY", "MATCHES STEFF"]),
        ("ALEJA", ["MATCHES ALEJA", "ALEJA"]),
        ("SOFI", ["MATCHES SOFI", "SOFI"]),
        ("LAU", ["MATCHES LAU", "LAU"]),
        ("MAPE D", ["MATCHES MAPE D", "MAPE D", "MAPE"]),
        ("MANU", ["MATCHES MANU", "MANU", "MATCHES MANU "]),
        ("ISA", ["MATCHES ISA", "ISA"]),
        ("PIA", ["MATCHES PIA", "PIA"])
    ]

    dates_saved_count = 0
    approved_dates_saved_count = 0

    for psyc_code, candidates in target_psychologists:
        exact_tab_title = None
        for cand in candidates:
            if cand in all_titles:
                exact_tab_title = all_titles[cand]
                break
            for k, orig in all_titles.items():
                if k.upper() == cand.upper() or k.upper().replace(" ", "") == cand.upper().replace(" ", ""):
                    exact_tab_title = orig
                    break
            if exact_tab_title:
                break

        if not exact_tab_title:
            print(f"   [WARN] No se encontró pestaña para {psyc_code}. Candidatos: {candidates}")
            continue

        res = sheets_api.values().get(spreadsheetId=SHEET_ID, range=f"'{exact_tab_title}'!A1:ZZ1000").execute()
        raw_values = res.get("values", [])
        if not raw_values:
            print(f"   [WARN] Pestaña {exact_tab_title} vacía.")
            continue

        headers = [str(h).strip().upper() for h in raw_values[0]]
        pA_idx, pB_idx, st_idx, obs_idx, date_idx, apro_date_idx, pais_idx = -1, -1, -1, -1, -1, -1, -1

        for i, h in enumerate(headers):
            if "APRO DATE" in h or ("APRO" in h and "DATE" in h):
                apro_date_idx = i
            elif "FECHA" in h or h == "DATE":
                date_idx = i
            elif "PAIS" in h or "COUNTRY" in h:
                pais_idx = i
            elif "PERSON A" in h or "PERSONA A" in h or h == "ADRIANA VIVAS":
                pA_idx = i
            elif "PERSON B" in h or "PERSONA B" in h:
                pB_idx = i
            elif "STATUS" in h or "ESTADO" in h:
                st_idx = i
            elif "OBS" in h or "NOTAS" in h or "OBSERVACIONES" in h:
                obs_idx = i

        if exact_tab_title.strip() == "MATCHES LAU":
            pA_idx, pB_idx, obs_idx = 0, 1, 2

        tab_inserts = []
        psyc_stats = {"total_rows": 0, "inserted": 0, "empty": 0, "dates_saved": 0, "apro_dates_saved": 0, "status_counts": {}}
        slot_tracker = {}
        now_val = datetime.now(timezone.utc).replace(tzinfo=None)

        start_row_idx = 3 if exact_tab_title.strip() == "MATCHES LAU" else 1

        for r_num, row in enumerate(raw_values[start_row_idx:], start=start_row_idx + 1):
            if not row or not any(row):
                continue
            psyc_stats["total_rows"] += 1

            val_fecha = row[date_idx] if date_idx != -1 and len(row) > date_idx else ""
            val_a = (row[pA_idx] if pA_idx != -1 and len(row) > pA_idx else "").strip()
            val_b = (row[pB_idx] if pB_idx != -1 and len(row) > pB_idx else "").strip()
            val_status_raw = (row[st_idx] if st_idx != -1 and len(row) > st_idx else "").strip().upper()
            val_apro = row[apro_date_idx] if apro_date_idx != -1 and len(row) > apro_date_idx else ""
            val_obs = row[obs_idx] if obs_idx != -1 and len(row) > obs_idx else ""
            val_pais = (row[pais_idx] if pais_idx != -1 and len(row) > pais_idx else "").strip()

            if not val_a and not val_b:
                psyc_stats["empty"] += 1
                continue

            dt_created = parse_date(val_fecha)
            if dt_created:
                psyc_stats["dates_saved"] += 1
                dates_saved_count += 1
            else:
                dt_created = now_val

            dt_approved = parse_date(val_apro)
            if dt_approved:
                psyc_stats["apro_dates_saved"] += 1
                approved_dates_saved_count += 1

            is_approved = (val_status_raw == "APROBADO") or bool(dt_approved)
            canonical_status = STATUS_MAPPING.get(val_status_raw, val_status_raw if val_status_raw else ("APROBADO" if is_approved else "PENDIENTE"))
            psyc_stats["status_counts"][canonical_status] = psyc_stats["status_counts"].get(canonical_status, 0) + 1

            uid_a = users_by_norm.get(normalize_text(val_a))
            uid_b = users_by_norm.get(normalize_text(val_b)) if val_b else None

            slot_tracker[val_a] = slot_tracker.get(val_a, 0) + 1
            slot_num = slot_tracker[val_a]

            tab_inserts.append((
                val_a,
                val_b,
                uid_a,
                uid_b,
                psyc_code,
                canonical_status,
                is_approved,
                dt_approved,
                val_obs,
                slot_num,
                dt_created,
                now_val,
                r_num,
                val_pais if val_pais else None
            ))

        if tab_inserts:
            await conn.executemany("""
                INSERT INTO operational_matches (
                    person_a, person_b, user_id_a, user_id_b, psychologist_name,
                    status, approved_by_maria, approved_at, observations, slot_number,
                    created_at, updated_at, sheet_row_index, pais
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            """, tab_inserts)
            psyc_stats["inserted"] = len(tab_inserts)
            total_om_inserted += len(tab_inserts)

        stats_by_psyc[psyc_code] = psyc_stats
        print(f"   ✓ {psyc_code:<8}: {len(tab_inserts)} insertados (fechas reales: {psyc_stats['dates_saved']}, apro dates: {psyc_stats['apro_dates_saved']})")

    print(f"\n[OK] Total operational_matches reconstruidos: {total_om_inserted}")
    print(f"     Total con fecha real de la hoja: {dates_saved_count}")
    print(f"     Total con fecha de aprobación guardada: {approved_dates_saved_count}")

    # 10. Reconstrucción de TROUBLE MATCHES
    print("\n--- PASO 7: Reconstruyendo trouble_matches desde la hoja ---")
    res_tr = sheets_api.values().get(spreadsheetId=SHEET_ID, range="'TROUBLE MATCHES'!A2:G300").execute()
    tr_rows = res_tr.get("values", [])
    tr_inserts = []
    now_val = datetime.now(timezone.utc).replace(tzinfo=None)

    for r_idx, row in enumerate(tr_rows, start=2):
        if not any(row): continue
        d_val = row[0] if len(row) > 0 else ""
        pa = (row[1] if len(row) > 1 else "").strip()
        pb = (row[2] if len(row) > 2 else "").strip()
        rep = (row[3] if len(row) > 3 else "").strip()
        reas = row[4] if len(row) > 4 else ""
        not_val = row[5] if len(row) > 5 else ""
        ven = row[6] if len(row) > 6 else ""

        if not pa: continue
        d_parsed = parse_date(d_val) or now_val
        tr_inserts.append((pa, pb, rep, reas, not_val, ven, d_parsed))

    if tr_inserts:
        await conn.executemany("""
            INSERT INTO trouble_matches (person_a, person_b, reported_by, reason, notes, venue, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, tr_inserts)
    print(f"[OK] Total trouble_matches reconstruidos: {len(tr_inserts)}")

    # 11. Reconstrucción de scheduled_dates desde MATCHES
    print("\n--- PASO 8: Reconstruyendo scheduled_dates desde MATCHES ---")
    res_m = sheets_api.values().get(spreadsheetId=SHEET_ID, range="'MATCHES'!A2:R4000").execute()
    m_rows = res_m.get("values", [])
    sd_inserts = []

    om_db_rows = await conn.fetch("SELECT id, person_a, person_b FROM operational_matches WHERE person_b IS NOT NULL AND person_b != '';")
    om_lookup = {}
    for r in om_db_rows:
        key = (normalize_text(r["person_a"]), normalize_text(r["person_b"]))
        if key not in om_lookup:
            om_lookup[key] = r["id"]

    for r_idx, row in enumerate(m_rows, start=2):
        if not any(row): continue
        m_date = row[1] if len(row) > 1 else ""
        ven = row[2] if len(row) > 2 else ""
        cit = row[3] if len(row) > 3 else ""
        pa = (row[4] if len(row) > 4 else "").strip()
        pb = (row[5] if len(row) > 5 else "").strip()
        status_m = row[8] if len(row) > 8 else ""
        resched_raw = row[9] if len(row) > 9 else ""
        fb_ella = row[11] if len(row) > 11 else ""
        fb_el = row[12] if len(row) > 12 else ""
        m_result = row[13] if len(row) > 13 else ""
        budget_val = row[14] if len(row) > 14 else ""

        if not pa: continue
        had_dt = True if "DONE" in status_m.upper() or "REALIZADA" in status_m.upper() or fb_ella or fb_el else False
        resched_bool = True if "SI" in resched_raw.upper() or "YES" in resched_raw.upper() else False

        m_id = om_lookup.get((normalize_text(pa), normalize_text(pb)))

        sd_inserts.append((
            m_id,
            pa,
            pb,
            m_date,
            ven,
            cit,
            had_dt,
            f"ELLA: {fb_ella} | ÉL: {fb_el}" if (fb_ella or fb_el) else None,
            resched_bool,
            now_val,
            fb_ella if fb_ella else None,
            fb_el if fb_el else None,
            m_result if m_result else None,
            budget_val if budget_val else None
        ))

    if sd_inserts:
        await conn.executemany("""
            INSERT INTO scheduled_dates (
                match_id, person_a, person_b, date_time, venue, city,
                had_date, feedback, reschedule, created_at,
                feedback_ella, feedback_el, match_result, budget
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        """, sd_inserts)
    print(f"[OK] Total scheduled_dates reconstruidos: {len(sd_inserts)}")

    # 12. Informe de Comparación
    print("\n" + "=" * 80)
    print("INFORME DE COMPARACIÓN: HOJA vs SISTEMA RECONSTRUIDO (dailylover_ensayo)")
    print("=" * 80)

    final_om = await conn.fetchval("SELECT count(*) FROM operational_matches;")
    final_sd = await conn.fetchval("SELECT count(*) FROM scheduled_dates;")
    final_tr = await conn.fetchval("SELECT count(*) FROM trouble_matches;")

    orig_om = await conn.fetchval("SELECT count(*) FROM operational_matches_pre_corte_20261001;")
    orig_sd = await conn.fetchval("SELECT count(*) FROM scheduled_dates_pre_corte_20261001;")
    orig_tr = await conn.fetchval("SELECT count(*) FROM trouble_matches_pre_corte_20261001;")

    print(f"Operational Matches: Original en sistema: {orig_om} | Reconstruido desde hoja: {final_om} (Diferencia: {final_om - orig_om})")
    print(f"Scheduled Dates:     Original en sistema: {orig_sd} | Reconstruido desde hoja: {final_sd} (Diferencia: {final_sd - orig_sd})")
    print(f"Trouble Matches:     Original en sistema: {orig_tr} | Reconstruido desde hoja: {final_tr} (Diferencia: {final_tr - orig_tr})")

    # Comparación por psicóloga
    print("\n--- Desglose por Psicóloga en dailylover_ensayo ---")
    print(f"{'Psicóloga':<12} | {'Hoja (Total)':<12} | {'Reconstruido':<12} | {'Fechas Reales':<14} | {'Apro Dates':<12}")
    print("-" * 75)
    for psyc, st in stats_by_psyc.items():
        print(f"{psyc:<12} | {st['total_rows']:<12} | {st['inserted']:<12} | {st['dates_saved']:<14} | {st['apro_dates_saved']:<12}")

    summary_report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": TARGET_DB,
        "operational_matches": {"original": orig_om, "rebuilt": final_om},
        "scheduled_dates": {"original": orig_sd, "rebuilt": final_sd},
        "trouble_matches": {"original": orig_tr, "rebuilt": final_tr},
        "dates_saved_count": dates_saved_count,
        "approved_dates_saved_count": approved_dates_saved_count,
        "stats_by_psyc": stats_by_psyc
    }
    with open("/app/ensayo_cero_report.json", "w", encoding="utf-8") as f:
        json.dump(summary_report, f, indent=2, ensure_ascii=False)
    print("\n[OK] Informe guardado en /app/ensayo_cero_report.json")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
