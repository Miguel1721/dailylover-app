#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ensayo 3 de Reconstrucción de Base de Datos Operativa (dailylover_ensayo)
========================================================================
SOLO sobre base de datos copia: dailylover_ensayo.
CERO escritura sobre base de datos de producción (dailylover).
Fuente: Google Sheets API v4 en vivo (spreadsheets.readonly) vía /app/service_account.json.

Reglas del Ensayo 3:
1. Agendado_por:
   - "MAPE" / "MAPE DE LA E" = MAPE D (María Paula de la Espriella), NO María Paula Salinas.
   - MPS solo cuando diga MPS, 650K o María Salinas.
   - CS staff_team: cata -> Catalina Cely Rueda, VALE/vale -> Valentina Ospina, vp -> Valentina Prieto, moni -> Monica Ospina.
2. Limpieza de nombres antes de enlazar con users:
   - Elimina sufijos ": De sofi", ": De manu", ". VIP", ". VIP 2nd date", fechas "10/07", puntos finales.
   - Filtra notas clínicas en nombres ("otw míos", "falta un match").
   - Aumenta drásticamente la tasa de enlace a users en SILVI, ISA, LAU, PIA, SOFI.
3. PROFILES MARIPAZ: columnas reales (FullName en col 4, UPDATE en col 5), 26 filas con 'falta'.
4. Citas: fechas de DÍA que no son cita quedan con date_time = NULL y solo date_time_raw.
5. Herencias canónicas completas (Sofi->Silvi, Aleja->Jenn, Lau->Isa, Maripaz->Ana, Manu->Steffy).
6. Pestaña '650 k': 14 clientes asignados a MPS con plan 650k.
7. Normalización de profiles.responsable a los 8 códigos únicos (SILVI, JENN, ANA, STEFFY, ISA, PIA, MAPE D, MPS).
8. Reportes exhaustivos de enlaces y herencias.
"""

import sys
import os
import json
import time
import re
import asyncio
from datetime import datetime, timezone
import unicodedata
from collections import Counter
import asyncpg
from google.oauth2 import service_account
from googleapiclient.discovery import build

TARGET_DB = "dailylover_ensayo"
DB_HOST = "dl_postgres"
DB_PORT = 5432
DB_USER = "postgres"
DB_PASS = "your_secure_postgres_password"

SHEET_ID = "113GBaGwDltILH4pMqbyvuK17rhCIxPFW0Cv4sLtBX5A"
CREDS_FILE = "/app/service_account.json"

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

RETIRED_TO_ACTIVE_PSYCHOLOGIST = {
    'SOFI': 'SILVI',
    'ALEJA': 'JENN',
    'LAU': 'ISA',
    'MARIPAZ': 'ANA',
    'MANU': 'STEFFY'
}

OP_NOTE_KEYWORDS = [
    'avisa', 'despues', 'después', 'vuelve', 'regresa', 'viaja', 'viaje', 'cancelo', 'cancela', 
    'canceló', 'cancelada', 'ya paso', 'ya pasó', 'pasó', 'paso', 'esperar', 'espera', 
    'no quiere', 'no le gusto', 'no le gustó', 'no sale', 'no va', 'descalificado', 'descalificada',
    'tacaño', 'percanse', 'percance', 'frenar', 'deje arriba', 'volver', 'llamar', 'habia puesto',
    'había puesto', 'se fue', 'cuadrado', 'esta cita', 'amigo', 'crm', 'celular', 'robaron',
    'no se si', 'incompleto', 'castidad', 'hijos', 'bravo', 'plantada', 'quiere', 'busca', 'otro match',
    'subir', 'bajar', 'escribir', 'reprogram', 'hablar', 'terremoto', 'tiempo', 'lesiono', 'interesada',
    'novia', 'saliendo', 'chat gpt', 'hospital', 'linkedin', 'demoramos', 'familia en', 'adicional'
]

OP_START_PATTERNS = re.compile(
    r'^(el\b|ella\b|a el\b|a ella\b|ya\b|no\b|se\b|es\b|nos\b|dijo\b|esta\b|este\b|'
    r'su date\b|a david\b|a alberto\b|a hector\b|a marcela\b|felipe\b|pedro\b|marcelo\b|'
    r'welkin\b|mateo\b|juan pablo\b|kevin\b|joha\b|jorge\b|alejo\b|gonzalo\b|le pregunte\b|'
    r'match innecesario\b|si jaime\b|extra para\b|lau esta\b|ambos ya\b|katerine\b|santiago\b|'
    r'juliana\b|laura esta\b|a nicolas\b|jeison\b|omar\b|miguel\b)', re.IGNORECASE
)

DATE_ATTACHED_REGEX = re.compile(r"^(.*?)[.\s]+(\d{1,2}[/-]\d{1,2})$")

def normalize_text(text):
    if not text:
        return ""
    text = unicodedata.normalize('NFKD', str(text)).encode('ASCII', 'ignore').decode('utf-8')
    return re.sub(r'\s+', ' ', text).strip().upper()

def clean_person_name(raw_name):
    """
    Limpia sufijos y anotaciones pegadas al nombre para maximizar enlace con users.
    Preserva el nombre real limpio.
    """
    if not raw_name:
        return ""
    s = str(raw_name).strip()

    # Si es texto clínico o nota operativa y no nombre
    if s.lower() in ['otw mios', 'otw míos', 'falta un match', 'pendiente', 'nadie', 'no hay']:
        return ""

    # Quitar sufijos ': de sofi', ': de manu', ': de ...'
    s = re.sub(r':\s*de\s+[a-zA-ZáéíóúÁÉÍÓÚñÑ]+.*$', '', s, flags=re.IGNORECASE).strip()

    # Quitar sufijos VIP: '. VIP 2nd date', '. VIP', 'VIP 2nd date', 'VIP', 'VIP Bog'
    s = re.sub(r'[.\s]+VIP(?:\s+\d+[a-z]{2}\s+date|\s+bog|\s+2nd\s+date|\s+second\s+date)?.*$', '', s, flags=re.IGNORECASE).strip()

    # Quitar fechas pegadas tipo '. 10/07', '10/07', '. 28/05', '15/05'
    s = re.sub(r'[.\s]+\d{1,2}[/-]\d{1,2}.*$', '', s).strip()

    # Quitar textos entre paréntesis si son notas
    s = re.sub(r'\s*\([^)]*\)', '', s).strip()

    # Quitar signos de puntuación finales
    s = re.sub(r'[.\-_,;:]+$', '', s).strip()

    return s

def is_operational_note(val_str):
    if not val_str:
        return False
    s = str(val_str).strip()
    s_lower = s.lower()
    if OP_START_PATTERNS.match(s_lower):
        return True
    if any(kw in s_lower for kw in OP_NOTE_KEYWORDS):
        return True
    return False

def parse_standard_date(date_val, default_year=2026):
    if not date_val:
        return None
    if isinstance(date_val, datetime):
        return date_val
    s = str(date_val).strip()
    if not s:
        return None

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass

    m3 = re.search(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b", s)
    if m3:
        d, mth, y = m3.groups()
        if len(y) == 2:
            y = "20" + y
        try:
            return datetime(int(y), int(mth), int(d))
        except ValueError:
            pass

    m2 = re.match(r"^(\d{1,2})[/.-](\d{1,2})$", s)
    if m2:
        p1, p2 = int(m2.group(1)), int(m2.group(2))
        if p2 > 12 and 1 <= p1 <= 12:
            mth_val, day_val = p1, p2
        elif 1 <= p2 <= 12 and 1 <= p1 <= 31:
            day_val, mth_val = p1, p2
        else:
            return None
        try:
            return datetime(default_year, mth_val, day_val)
        except ValueError:
            pass

    s_lower = s.lower()
    for m_name, m_num in MONTHS_ES.items():
        if re.search(r"\b" + m_name + r"\b", s_lower):
            day_m = re.search(r"\b([0-2]?\d|3[01])\b", s_lower)
            if day_m:
                try:
                    return datetime(default_year, m_num, int(day_m.group(1)))
                except ValueError:
                    pass

    return None

class ChronologicalDateParserStrict:
    def __init__(self, start_year=2025, start_month=10):
        self.current_year = start_year
        self.last_month = start_month

    def parse(self, text_val):
        if not text_val:
            return None, None
        s = str(text_val).strip()
        if not s:
            return None, None

        if is_operational_note(s):
            return None, s

        s_lower = s.lower()
        month_found = None
        day_found = None

        m_num = re.search(r'\b(0?[1-9]|1[0-2])[./-](0?[1-9]|[12]\d|3[01])\b', s_lower)
        if m_num:
            month_found = int(m_num.group(1))
            day_found = int(m_num.group(2))
        else:
            for m_name, m_val in MONTHS_ES.items():
                if re.search(r'\b' + m_name + r'\b', s_lower):
                    d_m = re.search(r'\b([0-2]?\d|3[01])\b', s_lower)
                    if d_m:
                        day_found = int(d_m.group(1))
                        month_found = m_val
                        break

        if month_found and day_found:
            if self.current_year == 2025 and month_found < 8 and self.last_month >= 8:
                self.current_year = 2026
            self.last_month = month_found
            try:
                dt = datetime(self.current_year, month_found, day_found)
                return dt, s
            except ValueError:
                return None, s

        return None, s

def normalize_agendado_por(val_b, val_c):
    """
    Normaliza el campo agendado_por según instrucciones del Ensayo 3:
    1. 'MAPE' / 'MAPE DE LA E' = MAPE D (María Paula de la Espriella), NO María Paula Salinas.
    2. MPS solo cuando diga MPS, 650K o María Salinas.
    3. Servicio al Cliente (staff_team):
       - 'cata', 'cat' -> Catalina Cely Rueda
       - 'vale', 'VALE', 'VALE OSP' -> Valentina Ospina
       - 'vp' -> Valentina Prieto
       - 'moni' -> Monica Ospina
    """
    raw = f"{val_b or ''} {val_c or ''}".strip().lower()
    if not raw:
        return None

    # MPS estricto
    if re.search(r'\b(mps|650k|650\s*k|maria\s+salinas|maría\s+salinas)\b', raw):
        return 'MPS'

    # MAPE / MAPE DE LA E = MAPE D (María Paula de la Espriella)
    if re.search(r'\b(mape\s+de\s+la\s+e|mape|mari\s+de\s+la\s+e)\b', raw):
        return 'MAPE D'

    # Staff de Servicio al Cliente
    if re.search(r'\b(cata|cat)\b', raw):
        return 'Catalina Cely Rueda'
    if re.search(r'\b(vale\s+ospina|vale\s+osp|valentina\s+ospina|vale)\b', raw):
        return 'Valentina Ospina'
    if re.search(r'\bvp\b', raw):
        return 'Valentina Prieto'
    if re.search(r'\b(moni|monica|mónica)\b', raw):
        return 'Monica Ospina'

    # Otras psicólogas del equipo
    if re.search(r'\b(steff|steffy|teffy)\b', raw):
        return 'STEFFY'
    if re.search(r'\b(manu|manuela)\b', raw):
        return 'MANU'
    if re.search(r'\b(lau|laura)\b', raw):
        return 'LAU'
    if re.search(r'\b(ana\s+tolosa|ana)\b', raw):
        return 'ANA'
    if re.search(r'\b(sofi|sofia|sofía)\b', raw):
        return 'SOFI'
    if re.search(r'\blina\b', raw):
        return 'LINA'

    cleaned = f"{str(val_b).strip() if val_b else ''} {str(val_c).strip() if val_c else ''}".strip()
    return cleaned if cleaned else None

def normalize_profile_responsable(raw_resp):
    if not raw_resp:
        return None
    s = str(raw_resp).strip().upper()
    s = s.replace("MATCHES ", "").strip()

    if s in ['MPS', 'MARIA', 'MARÍA', 'MARIA SALINAS', 'MARÍA SALINAS', 'MARIA PAULA SALINAS', 'MARÍA PAULA SALINAS']:
        return 'MPS'

    if s in ['MAPE D', 'MAPE', 'MARI DE LA E', 'MARI DE LA ESPRIELLA', 'MARIA PAULA', 'MARÍA PAULA', 'MARIA PAULA DE LA ESPRIELLA', 'MATCHES']:
        return 'MAPE D'

    if s in ['SILVI', 'SILVA', 'SILVANA', 'SILVIA']:
        return 'SILVI'
    if s in ['JENN', 'JENNIFER']:
        return 'JENN'
    if s in ['ANA', 'ANA TOLOSA']:
        return 'ANA'
    if s in ['STEFFY', 'STEFF', 'TEFFY', 'STEPHANIE']:
        return 'STEFFY'
    if s in ['ISA', 'ISA MARQUEZ', 'ISABELA', 'ISABELLA', 'ISABELA MARQUEZ']:
        return 'ISA'
    if s in ['PIA', 'PÍA']:
        return 'PIA'

    # Retiradas heredadas
    if s in ['SOFI', 'SOFIA ARIAS', 'SOFÍA ARIAS', 'SOFI ARIAS']:
        return 'SILVI'
    if s in ['ALEJA', 'ALEJANDRA', 'ALEJA - JENN']:
        return 'JENN'
    if s in ['LAU', 'LAURA']:
        return 'ISA'
    if s in ['MANU', 'MANUELA', 'MANU 1', 'MANU 2']:
        return 'STEFFY'
    if s in ['MARIPAZ', 'MARI SARMIENTO', 'MARI S', 'MARIS', 'MARI S Y MAPE', 'MARI B', 'MARIB', 'MARI PAZ', 'MARI PAZ Y MAPE']:
        return 'ANA'

    return None

async def main():
    print("=" * 80)
    print("ENSAYO 3: RECONSTRUCCIÓN CON LIMPIEZA AVANZADA DE NOMBRES Y AGENDADO_POR")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 80)

    if TARGET_DB != "dailylover_ensayo":
        print(f"[FATAL] La base de datos configurada es {TARGET_DB}. DEBE ser dailylover_ensayo.")
        sys.exit(1)

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

    # 1. Conectar a Google Sheets API v4 en vivo
    print("\n--- PASO 1: Conectando a Google Sheets API v4 en vivo ---")
    creds = service_account.Credentials.from_service_account_file(
        CREDS_FILE,
        scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
    )
    service = build('sheets', 'v4', credentials=creds)
    sheets_api = service.spreadsheets()

    meta = sheets_api.get(spreadsheetId=SHEET_ID).execute()
    all_titles = {s['properties']['title'].strip(): s['properties']['title'] for s in meta['sheets']}
    print(f"[OK] Google Sheets API conectada: {len(all_titles)} pestañas detectadas en vivo.")

    # 2. Respaldos pre-corte en dailylover_ensayo
    print("\n--- PASO 2: Creando respaldos pre-ensayo3 en dailylover_ensayo ---")
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS operational_matches_pre_ensayo3 AS SELECT * FROM operational_matches;
        CREATE TABLE IF NOT EXISTS scheduled_dates_pre_ensayo3 AS SELECT * FROM scheduled_dates;
        CREATE TABLE IF NOT EXISTS trouble_matches_pre_ensayo3 AS SELECT * FROM trouble_matches;
        CREATE TABLE IF NOT EXISTS profiles_pre_ensayo3 AS SELECT * FROM profiles;
    """)

    # 3. DDL
    print("\n--- PASO 3: Preparando esquema de base de datos ---")
    await conn.execute("""
        ALTER TABLE operational_matches ADD COLUMN IF NOT EXISTS pais text;
        ALTER TABLE operational_matches ADD COLUMN IF NOT EXISTS sheet_tab text;
        ALTER TABLE operational_matches ADD COLUMN IF NOT EXISTS original_psychologist text;
        ALTER TABLE operational_matches ADD COLUMN IF NOT EXISTS is_inherited boolean DEFAULT false;

        ALTER TABLE scheduled_dates ADD COLUMN IF NOT EXISTS match_result text;
        ALTER TABLE scheduled_dates ADD COLUMN IF NOT EXISTS budget text;
        ALTER TABLE scheduled_dates ADD COLUMN IF NOT EXISTS date_time_raw text;
        ALTER TABLE scheduled_dates ADD COLUMN IF NOT EXISTS agendado_por text;
        ALTER TABLE scheduled_dates ADD COLUMN IF NOT EXISTS sheet_row_index integer;

        ALTER TABLE trouble_matches ADD COLUMN IF NOT EXISTS sheet_row_index integer;

        ALTER TABLE trouble_matches ALTER COLUMN reported_by TYPE text;
        ALTER TABLE trouble_matches ALTER COLUMN person_a TYPE text;
        ALTER TABLE trouble_matches ALTER COLUMN person_b TYPE text;
        ALTER TABLE trouble_matches ALTER COLUMN venue TYPE text;

        ALTER TABLE scheduled_dates ALTER COLUMN person_a TYPE text;
        ALTER TABLE scheduled_dates ALTER COLUMN person_b TYPE text;

        ALTER TABLE operational_matches ALTER COLUMN person_a TYPE text;
        ALTER TABLE operational_matches ALTER COLUMN person_b TYPE text;
        ALTER TABLE operational_matches ALTER COLUMN person_a DROP NOT NULL;

        ALTER TABLE scheduled_dates ALTER COLUMN person_a DROP NOT NULL;
        ALTER TABLE scheduled_dates ALTER COLUMN person_b DROP NOT NULL;
    """)

    # 4. Tablas de archivo
    print("\n--- PASO 4: Preparando tablas de archivo auxiliar ---")
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS sheet_corazoncito_archive (
            id SERIAL PRIMARY KEY, sheet_row_index integer, ticket_date text, person text,
            cs_comment text, match_candidate text, psychologist text, match_date text,
            mm_comment text, status text, notes text, archived_at timestamp default now()
        );
        CREATE TABLE IF NOT EXISTS sheet_recompras_archive (
            id SERIAL PRIMARY KEY, sheet_row_index integer, psychologist text, person text,
            reason text, payment_date text, notes_1 text, notes_2 text, archived_at timestamp default now()
        );
        CREATE TABLE IF NOT EXISTS sheet_enamorados_archive (
            id SERIAL PRIMARY KEY, sheet_row_index integer, person_a text, person_b text,
            time_in_love text, match_date text, matchmaker text, notes text, archived_at timestamp default now()
        );
        CREATE TABLE IF NOT EXISTS sheet_profiles_archive (
            id SERIAL PRIMARY KEY, sheet_row_index integer, psychologist text, status_col_a text,
            person text, balance_notes text, archived_at timestamp default now()
        );
        CREATE TABLE IF NOT EXISTS sheet_doing_our_best_archive (
            id SERIAL PRIMARY KEY, sheet_row_index integer, person text, fecha_1 text, fecha_2 text,
            archived_at timestamp default now()
        );
        TRUNCATE TABLE sheet_corazoncito_archive, sheet_recompras_archive, sheet_enamorados_archive,
                       sheet_profiles_archive, sheet_doing_our_best_archive;
    """)

    # Corazoncito (449)
    res_cor = sheets_api.values().get(spreadsheetId=SHEET_ID, range="Corazoncito!A2:I600").execute()
    cor_inserts = []
    for r_idx, row in enumerate(res_cor.get("values", []), start=2):
        if not any(row): continue
        cor_inserts.append((
            r_idx,
            row[0] if len(row) > 0 else None, row[1] if len(row) > 1 else None,
            row[2] if len(row) > 2 else None, row[3] if len(row) > 3 else None,
            row[4] if len(row) > 4 else None, row[5] if len(row) > 5 else None,
            row[6] if len(row) > 6 else None, row[7] if len(row) > 7 else None,
            row[8] if len(row) > 8 else None
        ))
    if cor_inserts:
        await conn.executemany("""
            INSERT INTO sheet_corazoncito_archive (sheet_row_index, ticket_date, person, cs_comment, match_candidate, psychologist, match_date, mm_comment, status, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        """, cor_inserts)
    print(f"   ✓ sheet_corazoncito_archive: {len(cor_inserts)} registros en vivo (esperado: 449)")

    # VOLVIO A PAGAR (216)
    res_rec = sheets_api.values().get(spreadsheetId=SHEET_ID, range="VOLVIO A PAGAR!A2:F400").execute()
    rec_inserts = []
    for r_idx, row in enumerate(res_rec.get("values", []), start=2):
        if not any(row): continue
        rec_inserts.append((
            r_idx,
            row[0] if len(row) > 0 else None, row[1] if len(row) > 1 else None,
            row[2] if len(row) > 2 else None, row[3] if len(row) > 3 else None,
            row[4] if len(row) > 4 else None, row[5] if len(row) > 5 else None
        ))
    if rec_inserts:
        await conn.executemany("""
            INSERT INTO sheet_recompras_archive (sheet_row_index, psychologist, person, reason, payment_date, notes_1, notes_2)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, rec_inserts)
    print(f"   ✓ sheet_recompras_archive: {len(rec_inserts)} registros en vivo (esperado: 216)")

    # ENAMORADOS (29)
    res_enam = sheets_api.values().get(spreadsheetId=SHEET_ID, range="ENAMORADOS!A2:F200").execute()
    enam_inserts = []
    for r_idx, row in enumerate(res_enam.get("values", []), start=2):
        if not any(row): continue
        enam_inserts.append((
            r_idx,
            row[0] if len(row) > 0 else None, row[1] if len(row) > 1 else None,
            row[2] if len(row) > 2 else None, row[3] if len(row) > 3 else None,
            row[4] if len(row) > 4 else None, row[5] if len(row) > 5 else None
        ))
    if enam_inserts:
        await conn.executemany("""
            INSERT INTO sheet_enamorados_archive (sheet_row_index, person_a, person_b, time_in_love, match_date, matchmaker, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, enam_inserts)
    print(f"   ✓ sheet_enamorados_archive: {len(enam_inserts)} registros en vivo (esperado: 29)")

    # Doing our best (113)
    res_dob = sheets_api.values().get(spreadsheetId=SHEET_ID, range="'Doing our best'!A2:C200").execute()
    dob_inserts = []
    for r_idx, row in enumerate(res_dob.get("values", []), start=2):
        if not any(row): continue
        dob_inserts.append((
            r_idx,
            row[0] if len(row) > 0 else None,
            row[1] if len(row) > 1 else None,
            row[2] if len(row) > 2 else None
        ))
    if dob_inserts:
        await conn.executemany("""
            INSERT INTO sheet_doing_our_best_archive (sheet_row_index, person, fecha_1, fecha_2)
            VALUES ($1, $2, $3, $4)
        """, dob_inserts)
    print(f"   ✓ sheet_doing_our_best_archive: {len(dob_inserts)} registros en vivo (esperado: 113)")

    # PROFILES (MANU, SOFI, MARIPAZ, ALEJA, LAU)
    profiles_meta = [
        ("MANU", "PROFILES MANU", 0, 1, 2),
        ("SOFI", "PROFILES SOFI", 0, 1, 2),
        ("MARIPAZ", "PROFILES MARIPAZ", 0, 4, 5),
        ("ALEJA", "PROFILES ALEJA", 0, 1, 2),
        ("LAU", "PROFILES LAU", 0, 1, 2)
    ]
    prof_inserts = []
    prof_stats = {}
    for p_code, p_tab, col_st, col_name, col_note in profiles_meta:
        res_p = sheets_api.values().get(spreadsheetId=SHEET_ID, range=f"'{p_tab}'!A2:G500").execute()
        cnt = 0
        faltan_cnt = 0
        for r_idx, row in enumerate(res_p.get("values", []), start=2):
            if not any(row): continue
            colA = row[col_st] if len(row) > col_st else None
            person_n = row[col_name] if len(row) > col_name else None
            note_val = row[col_note] if len(row) > col_note else None

            if p_code == "MARIPAZ":
                extra_note = row[6] if len(row) > 6 else ""
                combined_note = f"{note_val or ''} {extra_note}".strip()
            else:
                combined_note = str(note_val).strip() if note_val else ""

            if not person_n and not combined_note:
                continue

            cnt += 1
            if combined_note and "FALTA" in combined_note.upper():
                faltan_cnt += 1

            prof_inserts.append((r_idx, p_code, colA, person_n, combined_note))
        prof_stats[p_code] = {"total": cnt, "faltan": faltan_cnt}

    if prof_inserts:
        await conn.executemany("""
            INSERT INTO sheet_profiles_archive (sheet_row_index, psychologist, status_col_a, person, balance_notes)
            VALUES ($1, $2, $3, $4, $5)
        """, prof_inserts)
    print(f"   ✓ sheet_profiles_archive: {len(prof_inserts)} registros guardados:")
    for p_code, st in prof_stats.items():
        print(f"       - {p_code:<8}: {st['total']:3} registros | {st['faltan']:3} con 'falta'")

    # 5. Indexar usuarios en memoria
    print("\n--- PASO 5: Indexando usuarios en base de datos ---")
    user_rows = await conn.fetch("SELECT id, name, client_code FROM users;")
    users_by_norm = {}
    users_first_last = {}

    for u in user_rows:
        n = normalize_text(u["name"])
        if n and n not in users_by_norm:
            users_by_norm[n] = u["id"]
        parts = n.split()
        if len(parts) >= 2:
            fl_key = (parts[0], parts[-1])
            # Solo si no colisiona
            if fl_key not in users_first_last:
                users_first_last[fl_key] = u["id"]
            else:
                users_first_last[fl_key] = None # Colisión detectada, anular para evitar falso positivo

    print(f"[OK] {len(users_by_norm)} usuarios indexados exactamente, {len([k for k,v in users_first_last.items() if v])} claves primer/último nombre únicas.")

    # 6. Truncar tablas operativas
    print("\n--- PASO 6: Truncando operational_matches, scheduled_dates y trouble_matches ---")
    await conn.execute("TRUNCATE TABLE operational_matches, scheduled_dates, trouble_matches CASCADE;")

    # 7. Reconstrucción de operational_matches con limpieza de nombres y herencias
    print("\n--- PASO 7: Reconstruyendo operational_matches con limpieza de nombres y herencia ---")
    psych_tabs = [
        ("MAPE D", ["MATCHES MAPE D", "MAPE D"]),
        ("JENN", ["MATCHES JENN", "JENN"]),
        ("PIA", ["MATCHES PIA", "PIA"]),
        ("ISA", ["MATCHES ISA", "ISA"]),
        ("STEFFY", ["MATCHES STEFFY", "STEFFY"]),
        ("SILVI", ["MATCHES SILVI", "SILVI"]),
        ("ANA", ["MATCHES ANA ", "MATCHES ANA", "ANA"]),
        ("ALEJA", ["MATCHES ALEJA", "ALEJA"]),
        ("SOFI", ["MATCHES SOFI", "SOFI"]),
        ("LAU", ["MATCHES LAU", "LAU"]),
        ("MANU", ["MATCHES MANU ", "MATCHES MANU", "MANU"])
    ]

    total_om_inserted = 0
    stats_by_psyc = {}
    now_val = datetime.now(timezone.utc).replace(tzinfo=None)

    def find_user_id(name_str):
        if not name_str:
            return None
        norm_exact = normalize_text(name_str)
        uid = users_by_norm.get(norm_exact)
        if uid:
            return uid
        # Fallback a (primer_nombre, ultimo_apellido) si es unívoco
        parts = norm_exact.split()
        if len(parts) >= 2:
            fl = users_first_last.get((parts[0], parts[-1]))
            if fl:
                return fl
        return None

    for psyc_orig, candidates in psych_tabs:
        exact_title = None
        for cand in candidates:
            if cand in all_titles:
                exact_title = all_titles[cand]
                break
        if not exact_title:
            continue

        res = sheets_api.values().get(spreadsheetId=SHEET_ID, range=f"'{exact_title}'!A1:ZZ2500").execute()
        raw_values = res.get("values", [])
        if not raw_values:
            continue

        headers = [str(c).strip().upper() if c else "" for c in raw_values[0]]
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

        if psyc_orig == "LAU":
            pA_idx, pB_idx, obs_idx = 0, 1, 2

        active_responsible = RETIRED_TO_ACTIVE_PSYCHOLOGIST.get(psyc_orig, psyc_orig)
        is_inherited_flag = (active_responsible != psyc_orig)

        tab_inserts = []
        psyc_stats = {
            "orig_code": psyc_orig,
            "active_responsible": active_responsible,
            "is_inherited": is_inherited_flag,
            "total_rows": 0,
            "has_pa": 0,
            "has_pb": 0,
            "both_ab": 0,
            "dates_saved": 0,
            "apro_dates_saved": 0,
            "linked_a": 0,
            "linked_b": 0,
            "unlinked_a_samples": [],
            "unlinked_b_samples": []
        }
        slot_tracker = {}
        start_row_idx = 15 if psyc_orig == "LAU" else 2

        for r_num, row in enumerate(raw_values[start_row_idx - 1:], start=start_row_idx):
            if not row or not any(row):
                continue

            raw_fecha = row[date_idx] if date_idx != -1 and len(row) > date_idx else None
            raw_a = str(row[pA_idx]).strip() if pA_idx != -1 and len(row) > pA_idx and row[pA_idx] is not None else ""
            raw_b = str(row[pB_idx]).strip() if pB_idx != -1 and len(row) > pB_idx and row[pB_idx] is not None else ""
            val_status_raw = str(row[st_idx]).strip().upper() if st_idx != -1 and len(row) > st_idx and row[st_idx] is not None else ""
            val_apro = row[apro_date_idx] if apro_date_idx != -1 and len(row) > apro_date_idx else None
            val_obs = str(row[obs_idx]).strip() if obs_idx != -1 and len(row) > obs_idx and row[obs_idx] is not None else ""
            val_pais = str(row[pais_idx]).strip() if pais_idx != -1 and len(row) > pais_idx and row[pais_idx] is not None else None

            # Extraer fecha pegada si existe
            if psyc_orig == "LAU" and raw_a:
                m_lau = DATE_ATTACHED_REGEX.match(raw_a)
                if m_lau:
                    raw_a = m_lau.group(1).strip()
                    raw_fecha = m_lau.group(2).strip()

            # Limpieza profunda de nombres
            clean_a = clean_person_name(raw_a)
            clean_b = clean_person_name(raw_b)

            if not clean_a and not clean_b and not raw_a and not raw_b:
                continue

            psyc_stats["total_rows"] += 1
            if clean_a: psyc_stats["has_pa"] += 1
            if clean_b: psyc_stats["has_pb"] += 1
            if clean_a and clean_b: psyc_stats["both_ab"] += 1

            dt_created = parse_standard_date(raw_fecha)
            if dt_created:
                psyc_stats["dates_saved"] += 1
            else:
                dt_created = now_val

            dt_approved = parse_standard_date(val_apro)
            if dt_approved:
                psyc_stats["apro_dates_saved"] += 1

            if psyc_orig == "LAU":
                canonical_status = "APROBADO" if clean_b else "PENDIENTE"
                is_approved = bool(clean_b)
            else:
                is_approved = (val_status_raw == "APROBADO") or bool(dt_approved)
                canonical_status = STATUS_MAPPING.get(val_status_raw, val_status_raw if val_status_raw else ("APROBADO" if is_approved else "PENDIENTE"))

            uid_a = find_user_id(clean_a)
            uid_b = find_user_id(clean_b)

            if uid_a:
                psyc_stats["linked_a"] += 1
            elif clean_a:
                if len(psyc_stats["unlinked_a_samples"]) < 5:
                    psyc_stats["unlinked_a_samples"].append(clean_a)

            if uid_b:
                psyc_stats["linked_b"] += 1
            elif clean_b:
                if len(psyc_stats["unlinked_b_samples"]) < 5:
                    psyc_stats["unlinked_b_samples"].append(clean_b)

            slot_tracker[clean_a] = slot_tracker.get(clean_a, 0) + 1
            slot_num = slot_tracker[clean_a]

            tab_inserts.append((
                clean_a if clean_a else (raw_a if raw_a else None),
                clean_b if clean_b else (raw_b if raw_b else None),
                uid_a,
                uid_b,
                active_responsible,      # Responsable actual (heredera)
                canonical_status,
                is_approved,
                dt_approved,
                val_obs if val_obs else None,
                slot_num,
                dt_created,
                now_val,
                r_num,
                val_pais,
                exact_title.strip(),
                psyc_orig,               # Psicóloga original
                is_inherited_flag        # Indicador de cartera heredada
            ))

        if tab_inserts:
            await conn.executemany("""
                INSERT INTO operational_matches (
                    person_a, person_b, user_id_a, user_id_b, psychologist_name,
                    status, approved_by_maria, approved_at, observations, slot_number,
                    created_at, updated_at, sheet_row_index, pais, sheet_tab,
                    original_psychologist, is_inherited
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            """, tab_inserts)
            total_om_inserted += len(tab_inserts)

        stats_by_psyc[psyc_orig] = psyc_stats
        print(f"   ✓ {psyc_orig:<8} -> {active_responsible:<8} (Heredada: {str(is_inherited_flag):<5}): {len(tab_inserts):4} insertados | Linked A: {psyc_stats['linked_a']:4} | Linked B: {psyc_stats['linked_b']:4}")

    # 8. Clientes del plan 650k (MPS)
    print("\n--- PASO 8: Reconstruyendo clientes del plan 650k (MPS) ---")
    res_650 = sheets_api.values().get(spreadsheetId=SHEET_ID, range="'650 k'!A2:E50").execute()
    rows_650 = res_650.get("values", [])
    inserts_650 = []

    for r_idx, row in enumerate(rows_650, start=2):
        if not any(row): continue
        f_date = row[1] if len(row) > 1 else None
        client_name = clean_person_name(str(row[2]).strip() if len(row) > 2 and row[2] else "")
        entrev_val = row[3] if len(row) > 3 else ""
        nota_val = row[4] if len(row) > 4 else ""

        if not client_name: continue
        dt_plan = parse_standard_date(f_date) or now_val
        uid_650 = find_user_id(client_name)

        inserts_650.append((
            client_name,
            None,
            uid_650,
            None,
            'MPS',                # María Paula Salinas
            'LISTO PARA MATCH',
            True,
            dt_plan,
            f"Plan 650k. Entrevista: {entrev_val}. Nota: {nota_val}".strip(),
            1,
            dt_plan,
            now_val,
            r_idx,
            'COL',
            '650 k',
            'MPS',
            False,
            '650k'
        ))

    if inserts_650:
        await conn.executemany("""
            INSERT INTO operational_matches (
                person_a, person_b, user_id_a, user_id_b, psychologist_name,
                status, approved_by_maria, approved_at, observations, slot_number,
                created_at, updated_at, sheet_row_index, pais, sheet_tab,
                original_psychologist, is_inherited, plan_tier
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        """, inserts_650)
        total_om_inserted += len(inserts_650)
    print(f"[OK] 650 k: {len(inserts_650)} clientes asignados a MPS con plan_tier='650k'")

    # 9. TROUBLE MATCHES en vivo
    print("\n--- PASO 9: Reconstruyendo trouble_matches en vivo por API ---")
    res_tr = sheets_api.values().get(spreadsheetId=SHEET_ID, range="'TROUBLE MATCHES'!A2:G2500").execute()
    tr_rows = res_tr.get("values", [])
    tr_inserts = []
    tr_stats = {"total_rows": 0, "inserted": 0, "has_pa": 0, "has_pb": 0, "both_ab": 0, "dates_saved": 0}

    for r_idx, row in enumerate(tr_rows, start=2):
        if not any(row): continue
        tr_stats["total_rows"] += 1

        d_val = row[0] if len(row) > 0 else None
        pa = clean_person_name(str(row[1]).strip() if len(row) > 1 and row[1] else "")
        pb = clean_person_name(str(row[2]).strip() if len(row) > 2 and row[2] else "")
        rep = str(row[3]).strip() if len(row) > 3 and row[3] else ""
        reas = str(row[4]).strip() if len(row) > 4 and row[4] else ""
        not_val = str(row[5]).strip() if len(row) > 5 and row[5] else ""
        ven = str(row[6]).strip() if len(row) > 6 and row[6] else ""

        if not pa and not pb:
            continue

        if pa: tr_stats["has_pa"] += 1
        if pb: tr_stats["has_pb"] += 1
        if pa and pb: tr_stats["both_ab"] += 1

        d_parsed = parse_standard_date(d_val)
        if d_parsed:
            tr_stats["dates_saved"] += 1
        else:
            d_parsed = now_val

        tr_inserts.append((
            pa if pa else None, pb if pb else None,
            rep if rep else None, reas if reas else None,
            not_val if not_val else None, ven if ven else None,
            d_parsed, r_idx
        ))

    if tr_inserts:
        await conn.executemany("""
            INSERT INTO trouble_matches (person_a, person_b, reported_by, reason, notes, venue, created_at, sheet_row_index)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """, tr_inserts)
        tr_stats["inserted"] = len(tr_inserts)
    print(f"[OK] trouble_matches: {len(tr_inserts)} insertados en vivo (con A: {tr_stats['has_pa']}, con A y B: {tr_stats['both_ab']})")

    # 10. scheduled_dates desde MATCHES con normalización estricta de agendado_por
    print("\n--- PASO 10: Reconstruyendo scheduled_dates con agendado_por depurado ---")
    res_m = sheets_api.values().get(spreadsheetId=SHEET_ID, range="'MATCHES'!A2:R3500").execute()
    m_rows = res_m.get("values", [])
    sd_inserts = []
    strict_date_parser = ChronologicalDateParserStrict(start_year=2025, start_month=10)

    colB_counter = Counter()
    colC_counter = Counter()

    sd_stats = {
        "total_rows": 0, "inserted": 0, "has_pa": 0, "has_pb": 0, "both_ab": 0,
        "with_dia": 0, "dates_parsed": 0, "notes_filtered": 0,
        "with_presupuesto": 0, "with_match": 0, "with_ella": 0, "with_el": 0,
        "agendado_por_counts": Counter()
    }

    om_db_rows = await conn.fetch("SELECT id, person_a, person_b FROM operational_matches WHERE person_a IS NOT NULL AND person_b IS NOT NULL;")
    om_lookup = {}
    for r in om_db_rows:
        key = (normalize_text(r["person_a"]), normalize_text(r["person_b"]))
        if key not in om_lookup:
            om_lookup[key] = r["id"]

    for r_idx, row in enumerate(m_rows, start=2):
        if not any(row): continue
        sd_stats["total_rows"] += 1

        val_b = row[1] if len(row) > 1 and row[1] else ""
        val_c = row[2] if len(row) > 2 and row[2] else ""
        if val_b: colB_counter[str(val_b).strip()] += 1
        if val_c: colC_counter[str(val_c).strip()] += 1

        pa = clean_person_name(str(row[3]).strip() if len(row) > 3 and row[3] else "")
        pb = clean_person_name(str(row[4]).strip() if len(row) > 4 and row[4] else "")
        dia_raw = str(row[5]).strip() if len(row) > 5 and row[5] else ""
        ven = str(row[6]).strip() if len(row) > 6 and row[6] else ""
        cit = str(row[7]).strip() if len(row) > 7 and row[7] else ""
        status_m = str(row[8]).strip() if len(row) > 8 and row[8] else ""
        resched_raw = str(row[9]).strip() if len(row) > 9 and row[9] else ""
        budget_val = str(row[12]).strip() if len(row) > 12 and row[12] else ""
        m_result = str(row[13]).strip() if len(row) > 13 and row[13] else ""
        fb_ella = str(row[15]).strip() if len(row) > 15 and row[15] else ""
        fb_el = str(row[16]).strip() if len(row) > 16 and row[16] else ""

        if not pa and not pb:
            continue

        if pa: sd_stats["has_pa"] += 1
        if pb: sd_stats["has_pb"] += 1
        if pa and pb: sd_stats["both_ab"] += 1
        if dia_raw: sd_stats["with_dia"] += 1
        if budget_val: sd_stats["with_presupuesto"] += 1
        if m_result: sd_stats["with_match"] += 1
        if fb_ella: sd_stats["with_ella"] += 1
        if fb_el: sd_stats["with_el"] += 1

        dt_cita, raw_text = strict_date_parser.parse(dia_raw)
        if dt_cita:
            sd_stats["dates_parsed"] += 1
        elif dia_raw:
            sd_stats["notes_filtered"] += 1

        # Normalización depurada de agendado_por
        agendador = normalize_agendado_por(val_b, val_c)
        if agendador:
            sd_stats["agendado_por_counts"][agendador] += 1

        had_dt = True if "DONE" in status_m.upper() or "REALIZADA" in status_m.upper() or fb_ella or fb_el else False
        resched_bool = True if "SI" in resched_raw.upper() or "YES" in resched_raw.upper() else False

        m_id = om_lookup.get((normalize_text(pa), normalize_text(pb))) or om_lookup.get((normalize_text(pb), normalize_text(pa)))

        fb_combined = None
        if fb_ella or fb_el:
            fb_combined = f"ELLA: {fb_ella} | ÉL: {fb_el}".strip()

        sd_inserts.append((
            m_id,
            pa if pa else None, pb if pb else None,
            dt_cita.strftime("%Y-%m-%d %H:%M:%S") if dt_cita else None,
            ven if ven else None, cit if cit else None,
            had_dt, fb_combined, resched_bool, now_val,
            fb_ella if fb_ella else None, fb_el if fb_el else None,
            m_result if m_result else None, budget_val if budget_val else None,
            raw_text, r_idx, agendador
        ))

    if sd_inserts:
        await conn.executemany("""
            INSERT INTO scheduled_dates (
                match_id, person_a, person_b, date_time, venue, city,
                had_date, feedback, reschedule, created_at,
                feedback_ella, feedback_el, match_result, budget,
                date_time_raw, sheet_row_index, agendado_por
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        """, sd_inserts)
        sd_stats["inserted"] = len(sd_inserts)

    print(f"[OK] scheduled_dates: {len(sd_inserts)} insertados")
    print(f"     Fechas reales de cita inferidas: {sd_stats['dates_parsed']}")
    print(f"     Notas operativas filtradas a NULL: {sd_stats['notes_filtered']}")
    print(f"     Presupuesto: {sd_stats['with_presupuesto']} | MATCH: {sd_stats['with_match']} | ELLA: {sd_stats['with_ella']} | ÉL: {sd_stats['with_el']}")
    print(f"     agendado_por MAPE D: {sd_stats['agendado_por_counts'].get('MAPE D', 0)}")
    print(f"     agendado_por MPS: {sd_stats['agendado_por_counts'].get('MPS', 0)}")

    # 11. Normalización de profiles.responsable
    print("\n--- PASO 11: Normalizando profiles.responsable ---")
    prof_db_rows = await conn.fetch("SELECT user_id, responsable FROM profiles;")
    prof_updates = []
    unmapped_responsable = Counter()
    mapped_counter = Counter()

    for r in prof_db_rows:
        u_id = r["user_id"]
        raw_resp = r["responsable"]
        if not raw_resp:
            continue
        norm_resp = normalize_profile_responsable(raw_resp)
        if norm_resp:
            mapped_counter[norm_resp] += 1
            prof_updates.append((norm_resp, u_id))
        else:
            unmapped_responsable[str(raw_resp).strip()] += 1

    for ins in inserts_650:
        u_650 = ins[2]
        if u_650:
            prof_updates.append(('MPS', u_650))
            await conn.execute("UPDATE profiles SET plan_tier = '650k', responsable = 'MPS' WHERE user_id = $1;", u_650)

    if prof_updates:
        await conn.executemany("UPDATE profiles SET responsable = $1 WHERE user_id = $2;", prof_updates)
    print(f"[OK] profiles.responsable actualizados ({len(prof_updates)} registros normalizados).")

    # 12. Consultas SQL Directas de Auditoría
    print("\n" + "=" * 80)
    print("CONSULTAS SQL DIRECTAS DE AUDITORÍA SOBRE dailylover_ensayo")
    print("=" * 80)

    query_carteras = await conn.fetch("""
        SELECT 
            psychologist_name as responsable_actual,
            count(*) as total_mesa,
            count(CASE WHEN is_inherited = false THEN 1 END) as cartera_propia,
            count(CASE WHEN is_inherited = true THEN 1 END) as cartera_heredada,
            count(user_id_a) as vinculados_a,
            count(user_id_b) as vinculados_b,
            round(count(user_id_a)::numeric / count(*) * 100, 1) as pct_vinculados_a
        FROM operational_matches
        GROUP BY psychologist_name
        ORDER BY total_mesa DESC;
    """)

    query_agendado = await conn.fetch("""
        SELECT agendado_por, count(*) as cant
        FROM scheduled_dates
        WHERE agendado_por IS NOT NULL AND agendado_por != ''
        GROUP BY agendado_por
        ORDER BY cant DESC;
    """)

    final_report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": TARGET_DB,
        "carteras_herederas": [dict(r) for r in query_carteras],
        "stats_by_psyc": stats_by_psyc,
        "agendado_por_breakdown": [dict(r) for r in query_agendado],
        "sd_stats": {
            "total_rows": sd_stats["total_rows"],
            "inserted": sd_stats["inserted"],
            "with_presupuesto": sd_stats["with_presupuesto"],
            "with_match": sd_stats["with_match"],
            "with_ella": sd_stats["with_ella"],
            "with_el": sd_stats["with_el"],
            "dates_parsed": sd_stats["dates_parsed"],
            "notes_filtered": sd_stats["notes_filtered"],
            "col_b_top": colB_counter.most_common(15),
            "col_c_top": colC_counter.most_common(15)
        },
        "profiles_normalization": {
            "mapped_counter": dict(mapped_counter),
            "unmapped_top": unmapped_responsable.most_common(15)
        }
    }

    with open("/app/ensayo_3_report.json", "w", encoding="utf-8") as f:
        json.dump(final_report, f, indent=2, ensure_ascii=False, default=str)
    print("\n[OK] Informe guardado en /app/ensayo_3_report.json")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
