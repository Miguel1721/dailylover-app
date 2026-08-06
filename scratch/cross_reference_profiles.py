#!/usr/bin/env python3
"""
Brief Técnico #22: Conectar PROFILES MANU / LAU / ALEJA con el sistema (Corregido)
Cruce de nombres contra dl_postgres (.162.11) y migración de notas sueltas de ALEJA.
"""

import sys
import os
import csv
import re
import unicodedata
from difflib import SequenceMatcher

import asyncpg
import asyncio
from google.oauth2 import service_account
from googleapiclient.discovery import build

SPREADSHEET_ID = "1LRhB6eFG07LCo5QrPFKilt1Op7XMeO_RxU28MyO2BSY"
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

async def main():
    conn = await asyncpg.connect(
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "your_secure_postgres_password"),
        database=os.environ.get("POSTGRES_DB", "dailylover"),
        host=os.environ.get("POSTGRES_HOST", "postgres"),
        port=5432
    )

    db_users = await conn.fetch("SELECT id, name FROM users WHERE name IS NOT NULL AND name != '';")
    user_map_exact = {}
    user_list = []

    for u in db_users:
        uid = u['id']
        raw_n = u['name']
        norm_n = normalize_name(raw_n)
        if norm_n:
            user_map_exact[norm_n] = (uid, raw_n)
            user_list.append((uid, raw_n, norm_n))

    print(f"Usuarios cargados de Postgres para cruce: {len(user_list)}")

    sheets_api = get_sheets_service()
    
    tabs_to_process = [
        ("PROFILES MANU", "reporte_profiles_manu.csv"),
        ("PROFILES LAU", "reporte_profiles_lau.csv"),
        ("PROFILES ALEJA", "reporte_profiles_aleja.csv"),
    ]

    os.makedirs("/app/scratch", exist_ok=True)
    notes_to_insert = []

    for tab_name, out_csv in tabs_to_process:
        print(f"\n--- Procesando pestaña '{tab_name}' ---")
        res = sheets_api.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"'{tab_name}'!A1:Z2000"
        ).execute()

        rows = res.get("values", [])
        if not rows:
            print(f"Pestaña '{tab_name}' vacía o sin datos.")
            continue

        out_rows = []
        c_exact = 0
        c_fuzzy = 0
        c_not_found = 0

        start_row = 1 if rows[0] and "NOMBRE" in str(rows[0][0]).upper() else 0

        for row_idx in range(start_row, len(rows)):
            row = rows[row_idx]
            if not row:
                continue

            orig_name = str(row[0]).strip()
            if not orig_name or orig_name.upper() in ["NOMBRE", "NAME", "CLIENTE"]:
                continue

            norm_orig = normalize_name(orig_name)
            matched_uid = None
            matched_name = ""
            match_type = "no_encontrado"

            # Match Exacto
            if norm_orig in user_map_exact:
                matched_uid, matched_name = user_map_exact[norm_orig]
                match_type = "exacto"
                c_exact += 1
            else:
                # Match Fuzzy (> 0.90)
                best_sim = 0.0
                best_match = None
                for uid, raw_n, norm_n in user_list:
                    sim = SequenceMatcher(None, norm_orig, norm_n).ratio()
                    if sim > best_sim and sim >= 0.90:
                        best_sim = sim
                        best_match = (uid, raw_n)

                if best_match:
                    matched_uid, matched_name = best_match
                    match_type = f"fuzzy_{best_sim:.2f}"
                    c_fuzzy += 1
                else:
                    c_not_found += 1

            # Extraer todas las columnas adicionales como notas
            extra_cols = [str(c).strip() for c in row[1:] if str(c).strip()]
            note_val = " | ".join(extra_cols)

            out_rows.append({
                "nombre_original": orig_name,
                "user_id_encontrado": matched_uid or "",
                "nombre_encontrado": matched_name or "",
                "tipo_match": match_type,
                "nota_columna_b": note_val
            })

            # Para PROFILES ALEJA: Si se matcheó y tiene notas, guardar para inserción en client_notes
            if tab_name == "PROFILES ALEJA" and matched_uid and note_val:
                notes_to_insert.append((matched_uid, note_val))

        # Escribir CSV
        out_csv_path = f"/app/scratch/{out_csv}"
        with open(out_csv_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "nombre_original", "user_id_encontrado", "nombre_encontrado", "tipo_match", "nota_columna_b"
            ])
            writer.writeheader()
            writer.writerows(out_rows)

        print(f"✅ {out_csv} generado:")
        print(f"   - Match Exacto:       {c_exact}")
        print(f"   - Match Fuzzy (>0.9): {c_fuzzy}")
        print(f"   - No Encontrados:     {c_not_found}")
        print(f"   - Total Filas:        {len(out_rows)}")

    # 3. Migrar las notas sueltas de ALEJA a client_notes en Postgres
    if notes_to_insert:
        print(f"\n--- Migrando {len(notes_to_insert)} notas sueltas de PROFILES ALEJA a client_notes ---")
        inserted_count = 0
        for uid, note_text in notes_to_insert:
            try:
                # Evitar duplicados revisando si la nota ya existe
                exists = await conn.fetchval(
                    "SELECT 1 FROM client_notes WHERE user_id = $1 AND note = $2 AND source = 'profiles_aleja_legacy';",
                    uid, note_text
                )
                if not exists:
                    await conn.execute("""
                        INSERT INTO client_notes (user_id, note, source, created_at)
                        VALUES ($1, $2, 'profiles_aleja_legacy', NOW())
                    """, uid, note_text)
                    inserted_count += 1
            except Exception as e:
                print(f"Error insertando nota para usuario ID {uid}: {e}")

        print(f"✅ {inserted_count}/{len(notes_to_insert)} notas únicas insertadas en client_notes (fuente: 'profiles_aleja_legacy').")

    await conn.close()
    print("\n✅ Brief Técnico #22 completado exitosamente.")

if __name__ == "__main__":
    asyncio.run(main())
