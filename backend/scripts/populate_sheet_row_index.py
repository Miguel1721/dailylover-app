#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Popula el campo sheet_row_index en operational_matches leyendo la posición
secuencial exacta de cada fila en las pestañas del Google Sheet de producción.
"""

import os
import sys
import unicodedata
import re
import asyncio
from google.oauth2 import service_account
from googleapiclient.discovery import build
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

sys.stdout.reconfigure(encoding='utf-8')

ORIGINAL_SHEET_ID = os.getenv("ORIGINAL_SHEET_ID", "113GBaGwDltILH4pMqbyvuK17rhCIxPFW0Cv4sLtBX5A")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:your_secure_postgres_password@dl_postgres:5432/dailylover"
)

CREDS_FILE = "/app/service_account.json"
if not os.path.isfile(CREDS_FILE):
    CREDS_FILE = "/home/ubuntu/dailylover/backend/service_account.json"
if not os.path.isfile(CREDS_FILE):
    CREDS_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../service_account.json"))


def clean_str(val: str) -> str:
    if not val:
        return ""
    return str(val).strip()


def normalize_name(name: str) -> str:
    if not name:
        return ""
    n = unicodedata.normalize('NFD', str(name))
    n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    n = re.sub(r'[^a-zA-Z0-9\s]', ' ', n)
    n = re.sub(r'\s+', ' ', n).strip().lower()
    return n


async def main():
    print("=" * 60)
    print("POBLANDO sheet_row_index EN operational_matches")
    print("=" * 60)

    # 1. Asegurar columna e índice en PostgreSQL
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with async_session() as session:
        await session.execute(text("ALTER TABLE operational_matches ADD COLUMN IF NOT EXISTS sheet_row_index INTEGER;"))
        await session.execute(text("CREATE INDEX IF NOT EXISTS idx_operational_matches_sheet_row ON operational_matches(psychologist_name, sheet_row_index);"))
        await session.commit()
    print("✓ Columna e índice sheet_row_index verificados en la base de datos.")

    # 2. Conectar a Google Sheets
    print(f"Leyendo Google Sheet: {ORIGINAL_SHEET_ID}")
    creds = service_account.Credentials.from_service_account_file(
        CREDS_FILE,
        scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
    )
    service = build('sheets', 'v4', credentials=creds)

    psyc_tabs = [
        ("MATCHES JENN", "JENN"),
        ("MATCHES SILVI", "SILVI"),
        ("MATCHES ANA ", "ANA"),
        ("MATCHES ANA", "ANA"),
        ("MATCHES STEFFY", "STEFFY"),
        ("MATCHES ALEJA", "ALEJA"),
        ("MATCHES SOFI", "SOFI"),
        ("MATCHES LAU", "LAU"),
        ("MATCHES MAPE D", "MAPE D"),
        ("MATCHES MANU ", "MANU"),
        ("MATCHES MANU", "MANU"),
        ("MATCHES ISA", "ISA"),
        ("MATCHES PIA", "PIA")
    ]

    total_updated = 0
    total_scanned = 0

    async with async_session() as session:
        for tab_name, psyc_code in psyc_tabs:
            try:
                res = service.spreadsheets().values().get(
                    spreadsheetId=ORIGINAL_SHEET_ID,
                    range=f"'{tab_name}'!A1:ZZ2500"
                ).execute()
                rows = res.get('values', [])
                if not rows:
                    continue

                headers = [clean_str(c).upper() for c in rows[0]]
                pA_idx = -1
                for i, h in enumerate(headers):
                    if "PERSON A" in h or "PERSONA A" in h or h == "ADRIANA VIVAS":
                        pA_idx = i
                        break
                if tab_name == "MATCHES LAU":
                    pA_idx = 0

                start_row = 3 if tab_name == "MATCHES LAU" else 1
                tab_updated = 0

                # Para cada fila del sheet, guardamos el número real de fila en la hoja (1-indexed)
                for r_num, r in enumerate(rows[start_row:], start=start_row + 1):
                    if not r:
                        continue
                    pA = clean_str(r[pA_idx]) if pA_idx != -1 and len(r) > pA_idx else ""
                    if not pA or pA.lower() in ("person a", "persona a", "tasks", "nombre"):
                        continue

                    total_scanned += 1
                    # Actualizar en operational_matches para esta psicóloga y este person_a
                    upd = await session.execute(
                        text("""
                            UPDATE operational_matches
                            SET sheet_row_index = :row_idx
                            WHERE UPPER(TRIM(psychologist_name)) = :psyc
                              AND LOWER(TRIM(person_a)) = LOWER(TRIM(:pa))
                              AND (sheet_row_index IS NULL OR sheet_row_index != :row_idx)
                        """),
                        {"row_idx": r_num, "psyc": psyc_code, "pa": pA}
                    )
                    tab_updated += upd.rowcount

                await session.commit()
                print(f"   -> [{tab_name}] Procesadas filas del Sheet. Filas de DB actualizadas: {tab_updated}")
                total_updated += tab_updated

            except Exception as e:
                print(f"   [!] Error procesando pestaña {tab_name}: {e}")

    await engine.dispose()
    print("=" * 60)
    print(f"FIN: Total filas del Sheet escaneadas: {total_scanned}")
    print(f"Total registros actualizados en DB: {total_updated}")
    print("=" * 60)


if __name__ == '__main__':
    asyncio.run(main())
