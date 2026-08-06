#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Brief #27 - Paso 1, 2 y 3: Comparar filas entre Sheet ORIGINAL y COPIA con detección dinámica de columnas.
ORIGINAL_ID: 113GBaGwDltILH4pMqbyvuK17rhCIxPFW0Cv4sLtBX5A
COPY_ID:     1LRhB6eFG07LCo5QrPFKilt1Op7XMeO_RxU28MyO2BSY
"""
import sys, os, re, unicodedata, json
from google.oauth2 import service_account
from googleapiclient.discovery import build

ORIGINAL_SPREADSHEET_ID = "113GBaGwDltILH4pMqbyvuK17rhCIxPFW0Cv4sLtBX5A"
COPY_SPREADSHEET_ID = "1LRhB6eFG07LCo5QrPFKilt1Op7XMeO_RxU28MyO2BSY"
CREDS_PATH = "/etc/dailylover/google-sheets-credentials.json"

def normalize_name(name: str) -> str:
    if not name:
        return ""
    n = unicodedata.normalize('NFD', str(name))
    n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    n = re.sub(r'\s+', ' ', n).strip().lower()
    return n

def get_sheets_service():
    if not os.path.exists(CREDS_PATH):
        raise FileNotFoundError(f"Credenciales no encontradas en {CREDS_PATH}")
    creds = service_account.Credentials.from_service_account_file(
        CREDS_PATH,
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
    )
    return build("sheets", "v4", credentials=creds)

TABS = [
    ("MATCHES JENN", "JENN"),
    ("MATCHES SILVI", "SILVI"),
    ("MATCHES ANA ", "ANA"),
    ("MATCHES STEFFY", "STEFFY"),
    ("MATCHES ALEJA", "ALEJA"),
    ("MATCHES SOFI", "SOFI"),
    ("MATCHES LAU", "LAU"),
    ("MATCHES MAPE D", "MAPE D"),
    ("MATCHES MANU ", "MANU"),
]

def find_columns(header):
    col_a, col_b, col_date, col_status, col_obs, col_city = None, None, None, None, None, None
    for idx, c in enumerate(header):
        c_str = str(c).strip().upper()
        if "PERSON A" in c_str or "PERSONA A" in c_str or c_str == "ADRIANA VIVAS":
            col_a = idx
        elif "PERSON B" in c_str or "PERSONA B" in c_str:
            col_b = idx
        elif "FECHA" in c_str or "DATE" in c_str or "DÍA" in c_str or "DIA" in c_str:
            col_date = idx
        elif "STATUS" in c_str or "ESTADO" in c_str:
            col_status = idx
        elif "OBS" in c_str or "NOTAS" in c_str or "OBSERVACIONES" in c_str:
            col_obs = idx
        elif "CITY" in c_str or "CIUDAD" in c_str:
            col_city = idx

    # Fallback para MATCHES LAU (Col 0: Person A, Col 1: Person B)
    if col_a is None and col_b == 1:
        col_a = 0

    return col_a, col_b, col_date, col_status, col_obs, col_city

def main():
    service = get_sheets_service()

    # 1. Probar acceso de lectura al Original
    print("=== PROBANDO ACCESO AL SHEET ORIGINAL (SOLO LECTURA) ===")
    try:
        meta_orig = service.spreadsheets().get(spreadsheetId=ORIGINAL_SPREADSHEET_ID).execute()
        print(f"✅ Acceso exitoso al Sheet Original: '{meta_orig['properties']['title']}' (ID: {ORIGINAL_SPREADSHEET_ID})")
    except Exception as e:
        print(f"❌ ERROR al acceder al Sheet Original ({ORIGINAL_SPREADSHEET_ID}): {e}")
        sys.exit(1)

    report = []
    total_new_rows = 0

    for tab_name, mm_code in TABS:
        # Leer Original
        res_orig = service.spreadsheets().values().get(
            spreadsheetId=ORIGINAL_SPREADSHEET_ID,
            range=f"'{tab_name}'!A1:Z3000"
        ).execute()
        rows_orig = res_orig.get("values", [])

        # Leer Copia
        res_copy = service.spreadsheets().values().get(
            spreadsheetId=COPY_SPREADSHEET_ID,
            range=f"'{tab_name}'!A1:Z3000"
        ).execute()
        rows_copy = res_copy.get("values", [])

        if not rows_orig:
            continue

        header_orig = rows_orig[0]
        col_a, col_b, col_date, col_status, col_obs, col_city = find_columns(header_orig)

        if col_a is None or col_b is None:
            print(f"⚠️  No se identificaron columnas A/B en '{tab_name}': {header_orig}")
            continue

        # Indexar filas de la Copia
        header_copy = rows_copy[0] if rows_copy else []
        ca_c, cb_c, _, _, _, _ = find_columns(header_copy)
        ca_c = ca_c if ca_c is not None else col_a
        cb_c = cb_c if cb_c is not None else col_b

        copy_keys = set()
        for idx in range(1, len(rows_copy)):
            r = rows_copy[idx]
            if len(r) > max(ca_c, cb_c):
                pa = str(r[ca_c]).strip()
                pb = str(r[cb_c]).strip()
                if pa and pb and pa.upper() not in ["PERSON A", "PERSONA A", "ID"]:
                    k = (normalize_name(pa), normalize_name(pb), mm_code.lower())
                    copy_keys.add(k)

        # Buscar filas nuevas en Original
        new_in_tab = []
        for idx in range(1, len(rows_orig)):
            r = rows_orig[idx]
            if len(r) > max(col_a, col_b):
                pa = str(r[col_a]).strip()
                pb = str(r[col_b]).strip()
                if pa and pb and pa.upper() not in ["PERSON A", "PERSONA A", "ID"]:
                    k = (normalize_name(pa), normalize_name(pb), mm_code.lower())
                    if k not in copy_keys:
                        d_val = str(r[col_date]).strip() if (col_date is not None and len(r) > col_date) else ""
                        s_val = str(r[col_status]).strip() if (col_status is not None and len(r) > col_status) else ""
                        o_val = str(r[col_obs]).strip() if (col_obs is not None and len(r) > col_obs) else ""
                        c_val = str(r[col_city]).strip() if (col_city is not None and len(r) > col_city) else ""

                        new_in_tab.append({
                            "tab": tab_name,
                            "matchmaker": mm_code,
                            "person_a": pa,
                            "person_b": pb,
                            "date": d_val,
                            "city": c_val,
                            "status": s_val,
                            "observations": o_val,
                            "row_index": idx + 1
                        })

        total_new_rows += len(new_in_tab)
        report.append({
            "tab": tab_name,
            "matchmaker": mm_code,
            "orig_total": len(rows_orig) - 1,
            "copy_total": len(rows_copy) - 1 if len(rows_copy) > 0 else 0,
            "new_count": len(new_in_tab),
            "new_rows": new_in_tab
        })

    print("\n==================================================")
    print("=== RESUMEN DE COMPARACIÓN REAL (ORIGINAL vs COPIA) ===")
    print("==================================================")
    print(f"Total de filas nuevas encontradas en Original: {total_new_rows}\n")

    for rep in report:
        print(f"Pestaña '{rep['tab']}' ({rep['matchmaker']}):")
        print(f"  Filas Original: {rep['orig_total']} | Filas Copia: {rep['copy_total']} | Nuevas: {rep['new_count']}")
        if rep["new_rows"]:
            print("  Muestra de filas nuevas:")
            for nr in rep["new_rows"][:10]:
                print(f"    - [Fila {nr['row_index']}] A: '{nr['person_a']}' <-> B: '{nr['person_b']}' | Fecha: '{nr['date']}' | Status: '{nr['status']}'")

    # Guardar reporte JSON en /app/scratch/brief27_comparison.json
    os.makedirs("/app/scratch", exist_ok=True)
    with open("/app/scratch/brief27_comparison.json", "w", encoding="utf-8") as f:
        json.dump({"total_new": total_new_rows, "report": report}, f, ensure_ascii=False, indent=2)
    print("\nReporte JSON guardado en: /app/scratch/brief27_comparison.json")

if __name__ == "__main__":
    main()
