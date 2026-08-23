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
