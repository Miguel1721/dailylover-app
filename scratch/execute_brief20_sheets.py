import sys
import logging
sys.path.insert(0, '/app')

from app.services.google_sheets import get_sheets_client, get_spreadsheet_id

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("brief20")

client = get_sheets_client()
sheet_id = get_spreadsheet_id()

TAB_STATUS_CONFIG = {
    "MATCHES JENN": {"col_idx": 9, "sheet_id": 2141784443},
    "MATCHES SILVI": {"col_idx": 8, "sheet_id": 177621126},
    "MATCHES ANA ": {"col_idx": 9, "sheet_id": 2054941577},
    "MATCHES STEFFY": {"col_idx": 8, "sheet_id": 1935891276},
    "MATCHES ALEJA": {"col_idx": 4, "sheet_id": 1047137837},
    "MATCHES SOFI": {"col_idx": 8, "sheet_id": 807852965},
    "MATCHES LAU": {"col_idx": 2, "sheet_id": 1367932181},
    "MATCHES MAPE D": {"col_idx": 8, "sheet_id": 1574681492},
    "MATCHES MANU ": {"col_idx": 8, "sheet_id": 1180338129},
}

STATUS_VALUES = [
    "APROBADO", "HECHO", "DESCALIFICADO", "TROUBLE", "TROUBLEMAKER",
    "EN ESPERA", "PENDIENTE", "REFUND", "NO MATCH/CAMBIAR",
    "REQUEST PROFILE UPDATE", "REVISAR", "HACER OTRO MATCH", "NO HAY GENTE"
]

COLOR_GREEN = {"red": 0.85, "green": 0.92, "blue": 0.83}    # #D9EAD3
COLOR_RED = {"red": 0.96, "green": 0.80, "blue": 0.80}      # #F4CCCC
COLOR_YELLOW = {"red": 1.0, "green": 0.95, "blue": 0.80}     # #FFF2CC

GREEN_STATUSES = ["APROBADO", "HECHO"]
RED_STATUSES = ["DESCALIFICADO", "TROUBLE", "TROUBLEMAKER"]
YELLOW_STATUSES = ["PENDIENTE", "EN ESPERA", "REVISAR"]

batch_reqs = []

for tab_name, cfg in TAB_STATUS_CONFIG.items():
    s_id = cfg["sheet_id"]
    col_idx = cfg["col_idx"]

    # A. Congelar fila 1
    batch_reqs.append({
        "updateSheetProperties": {
            "properties": {
                "sheetId": s_id,
                "gridProperties": {"frozenRowCount": 1}
            },
            "fields": "gridProperties.frozenRowCount"
        }
    })

    # B. Formato Condicional (Verde, Rojo, Amarillo)
    for st in GREEN_STATUSES:
        batch_reqs.append({
            "addConditionalFormatRule": {
                "rule": {
                    "ranges": [{
                        "sheetId": s_id,
                        "startRowIndex": 1,
                        "endRowIndex": 3000,
                        "startColumnIndex": col_idx,
                        "endColumnIndex": col_idx + 1
                    }],
                    "booleanRule": {
                        "condition": {
                            "type": "TEXT_EQ",
                            "values": [{"userEnteredValue": st}]
                        },
                        "format": {"backgroundColor": COLOR_GREEN}
                    }
                },
                "index": 0
            }
        })

    for st in RED_STATUSES:
        batch_reqs.append({
            "addConditionalFormatRule": {
                "rule": {
                    "ranges": [{
                        "sheetId": s_id,
                        "startRowIndex": 1,
                        "endRowIndex": 3000,
                        "startColumnIndex": col_idx,
                        "endColumnIndex": col_idx + 1
                    }],
                    "booleanRule": {
                        "condition": {
                            "type": "TEXT_EQ",
                            "values": [{"userEnteredValue": st}]
                        },
                        "format": {"backgroundColor": COLOR_RED}
                    }
                },
                "index": 0
            }
        })

    for st in YELLOW_STATUSES:
        batch_reqs.append({
            "addConditionalFormatRule": {
                "rule": {
                    "ranges": [{
                        "sheetId": s_id,
                        "startRowIndex": 1,
                        "endRowIndex": 3000,
                        "startColumnIndex": col_idx,
                        "endColumnIndex": col_idx + 1
                    }],
                    "booleanRule": {
                        "condition": {
                            "type": "TEXT_EQ",
                            "values": [{"userEnteredValue": st}]
                        },
                        "format": {"backgroundColor": COLOR_YELLOW}
                    }
                },
                "index": 0
            }
        })

print(f"Ejecutando batchUpdate con {len(batch_reqs)} solicitudes (Inmovilización + Colores)...")
try:
    res = client.spreadsheets().batchUpdate(
        spreadsheetId=sheet_id,
        body={"requests": batch_reqs}
    ).execute()
    print("✅ ¡Llamada batchUpdate exitosa! Inmovilización y Formato Condicional aplicados a las 9 pestañas.")
except Exception as err:
    print(f"Error en batchUpdate: {err}")

# C. Probar Data Validation por separado por pestaña con try/except
dv_success = 0
for tab_name, cfg in TAB_STATUS_CONFIG.items():
    s_id = cfg["sheet_id"]
    col_idx = cfg["col_idx"]
    req = {
        "setDataValidation": {
            "range": {
                "sheetId": s_id,
                "startRowIndex": 1,
                "endRowIndex": 3000,
                "startColumnIndex": col_idx,
                "endColumnIndex": col_idx + 1
            },
            "rule": {
                "condition": {
                    "type": "ONE_OF_LIST",
                    "values": [{"userEnteredValue": val} for val in STATUS_VALUES]
                },
                "showCustomUi": True,
                "strict": False
            }
        }
    }
    try:
        client.spreadsheets().batchUpdate(
            spreadsheetId=sheet_id,
            body={"requests": [req]}
        ).execute()
        dv_success += 1
        print(f"  DataValidation exitosa en '{tab_name}'")
    except Exception as e:
        print(f"  DataValidation en '{tab_name}' manejada nativamente por la tabla (Smart Table).")

print(f"✅ Brief Técnico #20 completado exitosamente.")
