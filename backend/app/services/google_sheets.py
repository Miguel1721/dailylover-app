"""
Google Sheets Real-Time Sync Service for Daily Lover.
Writes match events from SmartMatchApp into the corresponding psychologist's tab
in the live Google Sheet (https://docs.google.com/spreadsheets/d/1LRhB6eFG07LCo5QrPFKilt1Op7XMeO_RxU28MyO2BSY/).
One-way sync: System appends rows to the Sheet, never overwrites existing rows.
"""

import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

DEFAULT_SHEET_ID = "1LRhB6eFG07LCo5QrPFKilt1Op7XMeO_RxU28MyO2BSY"

def get_spreadsheet_id() -> str:
    return os.environ.get("GOOGLE_SHEETS_SPREADSHEET_ID", DEFAULT_SHEET_ID)


SHEET_COLUMN_MAP = {
    "JENN": {
        "tab": "MATCHES JENN",
        "cols": ["ID", "PAIS", "CITY", "PREF", "PLAN", "PERSON A", "PERSON B", "FECHA", "CRM", "STATUS", "OBSERVACIONES"]
    },
    "SILVI": {
        "tab": "MATCHES SILVI",
        "cols": ["ID", "PAIS", "CITY", "PREF", "PLAN", "PERSON A", "PERSON B", "FECHA", "STATUS", "OBSERVACIONES"]
    },
    "ANA": {
        "tab": "MATCHES ANA ",
        "cols": ["ID", "PAIS", "CITY", "PREF", "PLAN", "PERSON A", "PERSON B", "FECHA", "CRM", "STATUS", "OBSERVACIONES"]
    },
    "STEFFY": {
        "tab": "MATCHES STEFFY",
        "cols": ["ID", "PAIS", "CITY", "PREF", "PLAN", "PERSON A", "PERSON B", "FECHA", "STATUS", "OBSERVACIONES"]
    },
    "ALEJA": {
        "tab": "MATCHES ALEJA",
        "cols": ["PERSON A", "PERSON B", "FECHA", "CRM", "STATUS", "OBSERVACIONES", "APRO DATE"]
    },
    "SOFI": {
        "tab": "MATCHES SOFI",
        "cols": ["No.", "CITY", "PREF", "PLAN", "PERSON A", "PERSON B", "FECHA", "CRM", "STATUS", "OBSERVACIONES"]
    },
    "LAU": {
        "tab": "MATCHES LAU",
        "cols": ["PERSON A", "PERSON B", "OBSERVACIONES"]
    },
    "MAPE D": {
        "tab": "MATCHES MAPE D",
        "cols": ["ID", "PAIS", "CITY", "PREF", "PLAN", "PERSON A", "PERSON B", "FECHA", "STATUS", "OBSERVACIONES", "TAREAS"]
    },
    "MANU": {
        "tab": "MATCHES MANU ",
        "cols": ["ID", "PAIS", "CITY", "PREF", "PLAN", "PERSON A", "PERSON B", "CRM", "STATUS", "OBSERVACIONES"]
    }
}

MATCHMAKER_ALIASES = {
    "jenn": "JENN",
    "silvi": "SILVI",
    "ana": "ANA",
    "steff": "STEFFY",
    "steffy": "STEFFY",
    "aleja": "ALEJA",
    "sofi": "SOFI",
    "lau": "LAU",
    "mape": "MAPE D",
    "mape d": "MAPE D",
    "maria paula": "MAPE D",
    "maría paula": "MAPE D",
    "manu": "MANU",
}

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
    Escribe una fila de match en la pestaña de la psicóloga correspondiente en la Hoja de Cálculo.
    Garantiza que cualquier error no interrumpa el webhook de Postgres.
    """
    if not matchmaker_raw:
        return False

    key = matchmaker_raw.strip().lower()
    canonical = MATCHMAKER_ALIASES.get(key)
    if not canonical:
        logger.warning(f"Matchmaker '{matchmaker_raw}' no reconocido en MATCHMAKER_ALIASES, omitiendo sync a Sheet.")
        return False

    config = SHEET_COLUMN_MAP.get(canonical)
    if not config:
        logger.warning(f"No hay mapeo configurado para la psicóloga '{canonical}'")
        return False

    row = [str(match_data.get(col, "") or "") for col in config["cols"]]
    sheet_id = spreadsheet_id or get_spreadsheet_id()

    try:
        client = get_sheets_client()
        if not client:
            return False

        client.spreadsheets().values().append(
            spreadsheetId=sheet_id,
            range=f"{config['tab']}!A:A",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body={"values": [row]},
        ).execute()
        logger.info(f"✅ Match sincronizado exitosamente al Google Sheet en pestaña '{config['tab']}'")
        return True
    except Exception as e:
        logger.error(f"Error escribiendo en Google Sheet ({canonical}): {e}")
        return False

def prepare_matches_lau_header(spreadsheet_id: Optional[str] = None) -> bool:
    """Actualiza la fila 1 de MATCHES LAU a ['PERSON A', 'PERSON B', 'OBSERVACIONES']."""
    sheet_id = spreadsheet_id or get_spreadsheet_id()
    try:
        client = get_sheets_client()
        if not client:
            return False

        client.spreadsheets().values().update(
            spreadsheetId=sheet_id,
            range="MATCHES LAU!A1:C1",
            valueInputOption="RAW",
            body={"values": [["PERSON A", "PERSON B", "OBSERVACIONES"]]}
        ).execute()
        logger.info("✅ Encabezado de 'MATCHES LAU' actualizado correctamente.")
        return True
    except Exception as e:
        logger.error(f"Error actualizando encabezado de MATCHES LAU: {e}")
        return False

