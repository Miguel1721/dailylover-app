"""
Google Sheets Real-Time Sync Service for Daily Lover.
Writes match events from SmartMatchApp into the corresponding psychologist's tab
in the live Google Sheet.
One-way sync: System appends rows dynamically based on the Sheet's actual row 1 headers.
"""

import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

DEFAULT_SHEET_ID = "1ziZsPwYv6I3fEIEyVM7I0Na7LLgzrwyfM8vcglUQ8RA"

def get_spreadsheet_id() -> str:
    return os.environ.get("GOOGLE_SHEETS_SPREADSHEET_ID", DEFAULT_SHEET_ID)


# MAPA CANÓNICO DE PESTAÑAS (INCLUYE ESPACIOS EXACTOS DEL SHEET COMO 'MATCHES ANA ' Y 'MATCHES MANU ')
TAB_NAMES_MAP = {
    "JENN": "MATCHES JENN",
    "ANA": "MATCHES ANA ",
    "SILVI": "MATCHES SILVI",
    "STEFFY": "MATCHES STEFFY",
    "SOFI": "MATCHES SOFI",
    "MAPE D": "MATCHES MAPE D",
    "ALEJA": "MATCHES ALEJA",
    "MANU": "MATCHES MANU ",
    "PIA": "MATCHES PIA",
    "ISA": "MATCHES ISA",
}

MATCHMAKER_ALIASES = {
    "jenn": "JENN",
    "ana": "ANA",
    "silvi": "SILVI",
    "steff": "STEFFY",
    "steffy": "STEFFY",
    "sofi": "SOFI",
    "mape": "MAPE D",
    "mape d": "MAPE D",
    "maria paula": "MAPE D",
    "maría paula": "MAPE D",
    "aleja": "ALEJA",
    "manu": "MANU",
    "manu 1": "MANU",
    "manu 2": "MANU",
    "pia": "PIA",
    "isa": "ISA",
    "isabella": "ISA"
}

def get_canonical_tab_name(psyc_name: str) -> str:
    """Retorna el nombre exacto de la pestaña en el Sheet para la psicóloga dada."""
    if not psyc_name:
        return ""
    key = psyc_name.strip().lower()
    canonical = MATCHMAKER_ALIASES.get(key, psyc_name.strip().upper())
    return TAB_NAMES_MAP.get(canonical, f"MATCHES {canonical}")


def get_sheets_client():
    """Retorna un cliente de Google Sheets API autenticado con la cuenta de servicio."""
    creds_path = os.environ.get("GOOGLE_SHEETS_CREDENTIALS_PATH")
    if not creds_path or not os.path.exists(creds_path):
        logger.warning(f"Google Sheets Service Account JSON no configurado o ausente en ruta: {creds_path}")
        return None

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        creds = service_account.Credentials.from_service_account_file(
            creds_path,
            scopes=["https://www.googleapis.com/auth/spreadsheets"]
        )
        return build("sheets", "v4", credentials=creds)
    except Exception as e:
        logger.error(f"Error inicializando cliente de Google Sheets API: {e}")
        return None


def append_match_to_sheet(matchmaker_raw: str, match_data: Dict[str, Any], spreadsheet_id: Optional[str] = None) -> bool:
    """
    Escribe una fila de match en la pestaña de la psicóloga correspondiente.
    DINÁMICO: Lee los encabezados reales de la fila 1 del Sheet para ubicar cada columna por nombre,
    evitando corrimientos de columnas si se insertan nuevas columnas como 'PSICÓLOGA DE B'.
    """
    if not matchmaker_raw:
        return False

    tab_name = get_canonical_tab_name(matchmaker_raw)
    sheet_id = spreadsheet_id or get_spreadsheet_id()

    try:
        client = get_sheets_client()
        if not client:
            return False

        # 1. Leer encabezados reales de la Fila 1 de esa pestaña
        hdr_res = client.spreadsheets().values().get(
            spreadsheetId=sheet_id,
            range=f"'{tab_name}'!1:1"
        ).execute()

        rows = hdr_res.get("values", [])
        if not rows or not rows[0]:
            logger.warning(f"No se pudieron leer encabezados para la pestaña '{tab_name}'")
            return False

        headers = [h.strip().upper() for h in rows[0]]
        new_row = ["" for _ in range(len(headers))]

        # 2. Normalización de llaves de entrada
        normalized_data = {}
        for k, v in match_data.items():
            norm_k = k.strip().upper()
            normalized_data[norm_k] = str(v) if v is not None else ""

        # Mapeo de alias de campos estándar
        field_alias_map = {
            "ID": ["ID", "MATCH_ID", "NO."],
            "PAIS": ["PAIS", "PAIS ", "COUNTRY"],
            "CITY": ["CITY", "CIUDAD"],
            "PREF": ["PREF", "PREFERENCIA", "ORIENTATION"],
            "PLAN": ["PLAN", "PLAN_TIER", "PLAN TIER"],
            "PERSON A": ["PERSON A", "PERSONA A", "PERSON_A"],
            "PERSON B": ["PERSON B", "PERSONA B", "PERSON_B"],
            "PSICÓLOGA DE B": ["PSICÓLOGA DE B", "PSICOLOGA DE B", "PSICÓLOGA B", "PSICOLOGA B"],
            "FECHA": ["FECHA", "DATE", "FECHA_MATCH"],
            "CRM": ["CRM", "PERSON_A_CRM_ID", "CRM_ID"],
            "STATUS": ["STATUS", "ESTADO"],
            "OBSERVACIONES": ["OBSERVACIONES", "OBS", "OBSERVATIONS"],
            "TAREAS": ["TAREAS", "TASKS"]
        }

        # 3. Asignar cada valor a su columna real
        for col_idx, col_header in enumerate(headers):
            if not col_header:
                continue

            # Buscar si el encabezado coincide con algún alias
            assigned = False
            for canonical_key, aliases in field_alias_map.items():
                if col_header in aliases or any(col_header.startswith(a) for a in aliases):
                    for a in aliases:
                        if a in normalized_data and normalized_data[a]:
                            new_row[col_idx] = normalized_data[a]
                            assigned = True
                            break
                if assigned:
                    break

            if not assigned and col_header in normalized_data:
                new_row[col_idx] = normalized_data[col_header]

        # 4. Append a la hoja
        client.spreadsheets().values().append(
            spreadsheetId=sheet_id,
            range=f"'{tab_name}'!A:A",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body={"values": [new_row]},
        ).execute()
        logger.info(f"✅ Match sincronizado dinámicamente al Google Sheet en pestaña '{tab_name}'")
        return True
    except Exception as e:
        logger.error(f"Error escribiendo dinámicamente en Google Sheet ({tab_name}): {e}")
        return False


async def notify_apps_script_status_change(
    tab: str,
    row: Optional[int] = None,
    match_id: Optional[int] = None,
    slot_number: Optional[int] = None,
    new_status: Optional[str] = None,
    role: Optional[str] = None,
    person_a: Optional[str] = None,
    person_b: Optional[str] = None,
    person_a_crm_id: Optional[str] = None,
    person_b_crm_id: Optional[str] = None
) -> bool:
    """
    Envía un webhook HTTP POST al Web App de Google Apps Script cuando un STATUS cambia por API/Web,
    garantizando actualización instantánea en las pestañas derivadas sin esperar el trigger por tiempo.
    Incluye identificadores únicos (match_id, slot_number, CRM IDs) para desambiguar repeticiones.
    """
    webhook_url = os.environ.get("APPS_SCRIPT_WEBHOOK_URL")
    if not webhook_url:
        logger.debug("APPS_SCRIPT_WEBHOOK_URL no configurado, omitiendo notificación HTTP.")
        return False

    payload = {
        "tab": tab,
        "row": row,
        "match_id": match_id,
        "slot_number": slot_number,
        "new_status": new_status,
        "role": role or "sistema",
        "person_a": person_a,
        "person_b": person_b,
        "person_a_crm_id": person_a_crm_id,
        "person_b_crm_id": person_b_crm_id,
        "timestamp": datetime.utcnow().isoformat()
    }

    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(webhook_url, json=payload)
            if res.status_code in (200, 201, 302):
                logger.info(f"✅ Notificación de STATUS enviada a Apps Script ({tab} - {new_status} - match_id {match_id})")
                return True
            else:
                logger.warning(f"⚠️ Apps Script Webhook respondió status {res.status_code}")
                return False
    except Exception as e:
        logger.warning(f"No se pudo contactar el Web App de Apps Script: {e}")
        return False


def parse_date_to_iso(date_str: str) -> Optional[str]:
    """
    Parsea una fecha de cita en formato libre o CRM ("10.18", "10.24 7pm", "2026-10-18 19:30", "18/10/2026")
    a un string estándar ("YYYY-MM-DD" o "YYYY-MM-DD HH:MM") reconocido por Google Sheets como fecha real.
    """
    if not date_str:
        return None
    
    import re
    clean = str(date_str).strip()
    if clean.lower() in ("por agendar", "pendiente", "n/a", "none", ""):
        return None

    # 1. Formato ISO estándar: YYYY-MM-DD [HH:MM[:SS]]
    m_iso = re.match(r"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?", clean)
    if m_iso:
        y, m, d = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
        hr = m_iso.group(4)
        mn = m_iso.group(5)
        if hr and mn:
            return f"{y:04d}-{m:02d}-{d:02d} {int(hr):02d}:{int(mn):02d}"
        return f"{y:04d}-{m:02d}-{d:02d}"

    # 2. Formato latino: DD/MM/YYYY o DD-MM-YYYY
    m_lat = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?", clean)
    if m_lat:
        d, m, y = int(m_lat.group(1)), int(m_lat.group(2)), int(m_lat.group(3))
        hr = m_lat.group(4)
        mn = m_lat.group(5)
        if hr and mn:
            return f"{y:04d}-{m:02d}-{d:02d} {int(hr):02d}:{int(mn):02d}"
        return f"{y:04d}-{m:02d}-{d:02d}"

    # 3. Formatos cortos del equipo: "10.18", "10.24 7pm", "10.30 7:30 pm", "11.08 8:30pm"
    m_short = re.match(r"^(\d{1,2})[./](\d{1,2})(?:\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?", clean, re.IGNORECASE)
    if m_short:
        m, d = int(m_short.group(1)), int(m_short.group(2))
        raw_hr = m_short.group(3)
        raw_mn = m_short.group(4)
        ampm = (m_short.group(5) or "").lower()

        year = datetime.now().year
        if m < 1 or m > 12:
            d, m = m, d

        if raw_hr:
            hr = int(raw_hr)
            mn = int(raw_mn) if raw_mn else 0
            if ampm == "pm" and hr < 12:
                hr += 12
            elif ampm == "am" and hr == 12:
                hr = 0
            elif not ampm and 1 <= hr <= 11:
                if 6 <= hr <= 11:
                    hr += 12
            return f"{year:04d}-{m:02d}-{d:02d} {hr:02d}:{mn:02d}"

        return f"{year:04d}-{m:02d}-{d:02d}"

    return clean


def sync_confirmed_date_to_matches(
    person_a: str,
    person_b: str,
    raw_date: str,
    status: Optional[str] = None,
    venue: Optional[str] = None,
    city: Optional[str] = None,
    spreadsheet_id: Optional[str] = None
) -> bool:
    """
    Sincroniza una fecha de cita confirmada directamente a la columna 'FECHA CITA REAL'
    en la pestaña compartida 'MATCHES' del Google Sheet.
    Si el match ya existe en MATCHES, actualiza la fila existente.
    Si no existe, inserta una nueva fila con FECHA CITA REAL y estado confirmado.
    """
    if not person_a:
        return False

    clean_date = parse_date_to_iso(raw_date)
    if not clean_date:
        clean_date = str(raw_date).strip()

    sheet_id = spreadsheet_id or get_spreadsheet_id()
    client = get_sheets_client()
    if not client:
        return False

    try:
        tab_name = "MATCHES"
        # 1. Leer encabezados de fila 1
        hdr_res = client.spreadsheets().values().get(
            spreadsheetId=sheet_id,
            range=f"'{tab_name}'!1:1"
        ).execute()

        hdr_rows = hdr_res.get("values", [])
        if not hdr_rows or not hdr_rows[0]:
            logger.warning(f"No se pudieron leer encabezados de '{tab_name}'")
            return False

        headers = [h.strip().upper() for h in hdr_rows[0]]

        # Encontrar índices de columnas (0-based)
        p_a_idx = next((i for i, h in enumerate(headers) if h in ["PERSONA A", "PERSON A", "CLIENTE"]), 2)
        p_b_idx = next((i for i, h in enumerate(headers) if h in ["PERSONA B", "PERSON B", "CANDIDATO"]), 3)
        fecha_real_idx = next((i for i, h in enumerate(headers) if h in ["FECHA CITA REAL", "FECHA REAL", "FECHA CITA"]), 17)
        dia_idx = next((i for i, h in enumerate(headers) if h in ["DÍA", "DIA", "DÍA / HORA", "DIA / HORA"]), 4)
        lugar_idx = next((i for i, h in enumerate(headers) if h in ["LUGAR", "VENUE", "RESTAURANTE"]), 5)
        city_idx = next((i for i, h in enumerate(headers) if h in ["CIUDAD", "CITY"]), 6)
        status_idx = next((i for i, h in enumerate(headers) if h in ["MATCH", "ESTADO TOTAL", "STATUS"]), 12)

        # 2. Buscar si el match ya existe en MATCHES
        max_col_letter = chr(65 + len(headers) - 1) if len(headers) <= 26 else f"A{chr(65 + len(headers) - 27)}"
        data_res = client.spreadsheets().values().get(
            spreadsheetId=sheet_id,
            range=f"'{tab_name}'!A2:{max_col_letter}"
        ).execute()

        data_rows = data_res.get("values", [])
        target_row = None

        clean_p_a = person_a.strip().lower()
        clean_p_b = person_b.strip().lower() if person_b else ""

        for r_idx, row in enumerate(data_rows):
            row_p_a = row[p_a_idx].strip().lower() if len(row) > p_a_idx else ""
            row_p_b = row[p_b_idx].strip().lower() if len(row) > p_b_idx else ""

            if (row_p_a == clean_p_a and (not clean_p_b or row_p_b == clean_p_b)) or \
               (clean_p_b and row_p_a == clean_p_b and row_p_b == clean_p_a):
                target_row = r_idx + 2  # 1-based + 1 for header
                break

        updates = []
        st_val = status or "cita confirmada"

        if target_row:
            # Actualizar fila existente
            col_letter_fecha = chr(65 + fecha_real_idx) if fecha_real_idx < 26 else f"A{chr(65 + fecha_real_idx - 26)}"
            updates.append({
                "range": f"'{tab_name}'!{col_letter_fecha}{target_row}",
                "values": [[clean_date]]
            })

            col_letter_dia = chr(65 + dia_idx) if dia_idx < 26 else f"A{chr(65 + dia_idx - 26)}"
            updates.append({
                "range": f"'{tab_name}'!{col_letter_dia}{target_row}",
                "values": [[clean_date]]
            })

            col_letter_st = chr(65 + status_idx) if status_idx < 26 else f"A{chr(65 + status_idx - 26)}"
            updates.append({
                "range": f"'{tab_name}'!{col_letter_st}{target_row}",
                "values": [[st_val]]
            })

            if venue:
                col_letter_lugar = chr(65 + lugar_idx) if lugar_idx < 26 else f"A{chr(65 + lugar_idx - 26)}"
                updates.append({
                    "range": f"'{tab_name}'!{col_letter_lugar}{target_row}",
                    "values": [[venue]]
                })

            client.spreadsheets().values().batchUpdate(
                spreadsheetId=sheet_id,
                body={"valueInputOption": "USER_ENTERED", "data": updates}
            ).execute()
            logger.info(f"✅ FECHA CITA REAL actualizada en MATCHES (Fila {target_row}): {clean_date} para {person_a} x {person_b}")
            return True
        else:
            # Si no existe, insertar nueva fila con FECHA CITA REAL en MATCHES
            new_row = ["" for _ in range(len(headers))]
            new_row[p_a_idx] = person_a
            if person_b and p_b_idx < len(new_row):
                new_row[p_b_idx] = person_b
            if fecha_real_idx < len(new_row):
                new_row[fecha_real_idx] = clean_date
            if dia_idx < len(new_row):
                new_row[dia_idx] = clean_date
            if status_idx < len(new_row):
                new_row[status_idx] = st_val
            if venue and lugar_idx < len(new_row):
                new_row[lugar_idx] = venue
            if city and city_idx < len(new_row):
                new_row[city_idx] = city

            client.spreadsheets().values().append(
                spreadsheetId=sheet_id,
                range=f"'{tab_name}'!A:A",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": [new_row]}
            ).execute()
            logger.info(f"✅ Nuevo match con FECHA CITA REAL insertado en MATCHES: {clean_date} para {person_a} x {person_b}")
            return True

    except Exception as e:
        logger.error(f"Error sincronizando FECHA CITA REAL a MATCHES: {e}")
        return False

