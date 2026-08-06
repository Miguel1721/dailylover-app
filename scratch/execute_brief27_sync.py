#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Brief Técnico #27 - Paso 4: Traer las 29 filas nuevas a la COPIA (Google Sheets) y a Postgres (historical_matches).
NO se toca el Sheet Original (113GBaGwDltILH4pMqbyvuK17rhCIxPFW0Cv4sLtBX5A).
"""
import sys, os, re, unicodedata, json, hashlib, asyncio
import asyncpg
from google.oauth2 import service_account
from googleapiclient.discovery import build

COPY_SPREADSHEET_ID = "1LRhB6eFG07LCo5QrPFKilt1Op7XMeO_RxU28MyO2BSY"
CREDS_PATH = "/etc/dailylover/google-sheets-credentials.json"
PLAN_PATH = "/app/scratch/brief27_comparison.json"

def normalize_name(name: str) -> str:
    if not name:
        return ""
    n = unicodedata.normalize('NFD', str(name))
    n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    n = re.sub(r'\s+', ' ', n).strip().lower()
    return n

def make_source_ref(source: str, row_dict: dict) -> str:
    pa = normalize_name(row_dict.get("person_a", ""))
    pb = normalize_name(row_dict.get("person_b", ""))
    mm = str(row_dict.get("matchmaker", "")).strip().lower()
    dt = str(row_dict.get("date", "")).strip().lower()
    raw_str = f"{source}:{mm}:{pa}:{pb}:{dt}"
    return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()[:32]

def get_sheets_service():
    if not os.path.exists(CREDS_PATH):
        raise FileNotFoundError(f"Credenciales no encontradas en {CREDS_PATH}")
    creds = service_account.Credentials.from_service_account_file(
        CREDS_PATH,
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    return build("sheets", "v4", credentials=creds)

async def main():
    # 1. Cargar plan con las 29 filas nuevas
    with open(PLAN_PATH, encoding="utf-8") as f:
        data = json.load(f)

    report = data["report"]
    total_new = data["total_new"]
    print(f"Cargado plan con {total_new} filas nuevas para procesar.")

    if total_new == 0:
        print("No hay filas nuevas para sincronizar.")
        return

    # 2. Conectar a Postgres (.162.11)
    conn = await asyncpg.connect(
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "your_secure_postgres_password"),
        database=os.environ.get("POSTGRES_DB", "dailylover"),
        host=os.environ.get("POSTGRES_HOST", "postgres"),
        port=5432
    )

    db_users = await conn.fetch("SELECT id, name FROM users WHERE name IS NOT NULL AND name != '';")
    user_map_exact = {normalize_name(u['name']): (u['id'], u['name']) for u in db_users}

    sheets_service = get_sheets_service()

    sheets_appended = 0
    matches_inserted = 0
    new_users_created = []

    for rep in report:
        tab_name = rep["tab"]
        mm_code = rep["matchmaker"]
        new_rows = rep["new_rows"]

        if not new_rows:
            continue

        print(f"\n--- Procesando pestaña '{tab_name}' ({len(new_rows)} filas nuevas) ---")

        # Leer encabezado de la Copia para saber orden exacto de columnas
        res_copy_hdr = sheets_service.spreadsheets().values().get(
            spreadsheetId=COPY_SPREADSHEET_ID,
            range=f"'{tab_name}'!A1:Z1"
        ).execute()
        hdr = res_copy_hdr.get("values", [[]])[0]

        copy_append_values = []

        for nr in new_rows:
            pa = nr["person_a"]
            pb = nr["person_b"]
            dt = nr["date"]
            st = nr["status"]
            obs = nr["observations"]
            ct = nr["city"]

            # Resolver user_id_a y user_id_b en Postgres
            pa_norm = normalize_name(pa)
            pb_norm = normalize_name(pb)

            uid_a = user_map_exact.get(pa_norm, (None, None))[0]
            uid_b = user_map_exact.get(pb_norm, (None, None))[0]

            # Si Person A no existe en DB, crear cliente nuevo en users + profiles
            if not uid_a and pa:
                # Generar teléfono sintético único
                seq_a = await conn.fetchval("SELECT nextval('users_id_seq');")
                synth_phone_a = f"+5730000{seq_a:05d}"
                new_u_a = await conn.fetchrow("""
                    INSERT INTO users (id, name, phone, created_at)
                    VALUES ($1, $2, $3, NOW())
                    RETURNING id, name;
                """, seq_a, pa, synth_phone_a)
                uid_a = new_u_a['id']
                await conn.execute("INSERT INTO profiles (user_id, city, updated_at) VALUES ($1, $2, NOW());", uid_a, ct)
                user_map_exact[pa_norm] = (uid_a, pa)
                new_users_created.append({"id": uid_a, "name": pa, "phone": synth_phone_a, "tab": tab_name})
                print(f"  ✨ Cliente NUEVO creado en Postgres: '{pa}' (ID {uid_a}, Phone {synth_phone_a})")

            # Si Person B no existe en DB, crear cliente nuevo en users + profiles
            if not uid_b and pb:
                # Generar teléfono sintético único
                seq_b = await conn.fetchval("SELECT nextval('users_id_seq');")
                synth_phone_b = f"+5730000{seq_b:05d}"
                new_u_b = await conn.fetchrow("""
                    INSERT INTO users (id, name, phone, created_at)
                    VALUES ($1, $2, $3, NOW())
                    RETURNING id, name;
                """, seq_b, pb, synth_phone_b)
                uid_b = new_u_b['id']
                await conn.execute("INSERT INTO profiles (user_id, city, updated_at) VALUES ($1, $2, NOW());", uid_b, ct)
                user_map_exact[pb_norm] = (uid_b, pb)
                new_users_created.append({"id": uid_b, "name": pb, "phone": synth_phone_b, "tab": tab_name})
                print(f"  ✨ Cliente NUEVO creado en Postgres: '{pb}' (ID {uid_b}, Phone {synth_phone_b})")

            # Insertar en historical_matches con ON CONFLICT (source_ref) DO NOTHING
            source_ref = make_source_ref("original_sheet_manual", nr)
            ins_res = await conn.execute("""
                INSERT INTO historical_matches (
                    person_a, person_b, matchmaker, match_date, city, status, observations,
                    user_id_a, user_id_b, source_ref, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                ON CONFLICT (source_ref) DO NOTHING;
            """, pa, pb, mm_code, dt, ct, st, obs, uid_a, uid_b, source_ref)

            if "INSERT 0 1" in ins_res:
                matches_inserted += 1

            # Construir fila para append en la COPIA (omitir JENN ya insertada si aplica, o append normal)
            row_out = []
            for col_title in hdr:
                ct_u = str(col_title).strip().upper()
                if "PERSON A" in ct_u or "PERSONA A" in ct_u or ct_u == "ADRIANA VIVAS":
                    row_out.append(pa)
                elif "PERSON B" in ct_u or "PERSONA B" in ct_u:
                    row_out.append(pb)
                elif "FECHA" in ct_u or "DATE" in ct_u or "DÍA" in ct_u or "DIA" in ct_u:
                    row_out.append(dt)
                elif "STATUS" in ct_u or "ESTADO" in ct_u:
                    row_out.append(st)
                elif "OBS" in ct_u or "NOTAS" in ct_u or "OBSERVACIONES" in ct_u:
                    row_out.append(obs)
                elif "CITY" in ct_u or "CIUDAD" in ct_u:
                    row_out.append(ct)
                else:
                    row_out.append("")

            copy_append_values.append(row_out)

        # Ejecutar append en la COPIA (Google Sheets) si no fue procesado
        if copy_append_values and tab_name != "MATCHES JENN":
            sheets_service.spreadsheets().values().append(
                spreadsheetId=COPY_SPREADSHEET_ID,
                range=f"'{tab_name}'!A1",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": copy_append_values}
            ).execute()
            sheets_appended += len(copy_append_values)
            print(f"  ✅ {len(copy_append_values)} filas añadidas exitosamente a la COPIA en '{tab_name}'")
        elif tab_name == "MATCHES JENN":
            sheets_appended += len(copy_append_values)
            print(f"  ℹ️ {len(copy_append_values)} filas ya añadidas anteriormente a la COPIA en '{tab_name}'")

    await conn.close()

    print("\n==================================================")
    print("=== RESUMEN EJECUTIVO BRIEF #27 ===")
    print("==================================================")
    print(f"Filas leídas del Sheet Original:              {total_new}")
    print(f"Filas escritas en la COPIA (Google Sheets):    {sheets_appended}")
    print(f"Matches insertados en Postgres (historical_matches): {matches_inserted}")
    print(f"Clientes totalmente nuevos creados en Postgres: {len(new_users_created)}")
    for nu in new_users_created:
        print(f"   - ID {nu['id']}: '{nu['name']}' (Teléfono sintético: {nu['phone']}, Pestaña: {nu['tab']})")

    print("\n✅ Brief Técnico #27 completado exitosamente.")

if __name__ == "__main__":
    asyncio.run(main())
