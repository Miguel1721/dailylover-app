import os, sys, re, asyncio, unicodedata
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from sqlalchemy import text
from app.database import AsyncSessionLocal

sys.stdout.reconfigure(line_buffering=True)

def strip_accents(s):
    if not s:
        return ""
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def clean_sheet_name(raw_name):
    if not raw_name:
        return ""
    # Remove (VIP), VIP, trailing tags
    cleaned = re.sub(r'\s*\((?:vip|tardeo|bogota|cali|medellin)[^)]*\)', '', raw_name, flags=re.IGNORECASE)
    cleaned = re.sub(r'\b(?:vip|tardeo)\b', '', cleaned, flags=re.IGNORECASE)
    # Remove multiple spaces
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

async def main():
    service_account_path = "/app/service_account.json"
    if not os.path.exists(service_account_path):
        service_account_path = "backend/service_account.json"

    creds = Credentials.from_service_account_file(
        service_account_path,
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    service = build('sheets', 'v4', credentials=creds)
    sheet_id = os.environ.get("AGOSTO27_SHEET_ID", "1tCV7lIE-uypmDELyNz9bWdS95DEzCHO9EUbCszVa9co")

    result = service.spreadsheets().values().get(
        spreadsheetId=sheet_id,
        range="'Missing Matches'!A1:E600"
    ).execute()
    rows = result.get('values', [])
    print(f"Total rows retrieved from Google Sheet: {len(rows)}")

    resolved_patterns = [
        r'ya\s+tiene.*match',
        r'match.*aprobado',
        r'tiene\s+\d+\s+nuevos?\s+match',
        r'\baprobado\b',
        r'ya\s+se\s+le\s+hizo\s+match',
        r'match\s+hecho',
        r'ya\s+se\s+le\s+hicieron',
        r'ya\s+tiene\s+match',
        r'\bdone\b',
        r'\bok\b',
        r'ya\s+le\s+hice\s+match',
        r'ya\s+estan\s+ambos',
        r'ya\s+esta\s+en\s+mi\s+tab',
        r'ya\s+tiene\s+su\s+match'
    ]

    refund_patterns = [
        r'refund',
        r'no\s+hay\s+gente',
        r'no\s+hay\s+candidat',
        r'ofrecer\s+refund',
        r'pedir\s+refund',
        r'devolucion',
        r'no\s+hay\s+perfiles',
        r'descalificad'
    ]

    no_crm_patterns = [
        r'no\s+lo\s+encontr[eé]\s+en\s+(el\s+)?crm',
        r'no\s+est[aá]\s+en\s+(el\s+)?crm',
        r'no\s+existe\s+en\s+(el\s+)?crm',
        r'sin\s+perfil\s+en\s+(el\s+)?crm',
        r'nunca\s+llego\s+el\s+perfil\s+de\s+crm'
    ]

    valid_pending = []
    ignored_resolved = []
    ignored_refund = []
    ignored_no_crm = []
    ignored_empty = []

    for idx, r in enumerate(rows[1:], start=2):
        resp = r[0].strip() if len(r) > 0 and r[0] else ""
        fecha = r[1].strip() if len(r) > 1 and r[1] else ""
        raw_name = r[2].strip() if len(r) > 2 and r[2] else ""
        dates_pend = r[3].strip() if len(r) > 3 and r[3] else ""
        nota = r[4].strip() if len(r) > 4 and r[4] else ""

        if not raw_name:
            ignored_empty.append((idx, r))
            continue

        nl = nota.lower()
        if any(re.search(p, nl) for p in resolved_patterns):
            ignored_resolved.append((idx, raw_name, nota))
        elif any(re.search(p, nl) for p in refund_patterns):
            ignored_refund.append((idx, raw_name, nota))
        elif any(re.search(p, nl) for p in no_crm_patterns):
            ignored_no_crm.append((idx, raw_name, nota))
        else:
            valid_pending.append({
                "row": idx,
                "resp": resp,
                "fecha": fecha,
                "raw_name": raw_name,
                "clean_name": clean_sheet_name(raw_name),
                "dates_pend": dates_pend,
                "nota": nota
            })

    print(f"--- FILTRADO PREVIO ---")
    print(f"Total datos: {len(rows)-1}")
    print(f"Ignorados Vacíos: {len(ignored_empty)}")
    print(f"Ignorados Resueltos/Match Aprobado: {len(ignored_resolved)}")
    print(f"Ignorados Refund/Sin Gente: {len(ignored_refund)}")
    print(f"Ignorados Sin CRM en nota: {len(ignored_no_crm)}")
    print(f"Pendientes reales a emparejar con BD: {len(valid_pending)}")

    matched_users = []
    unmatched_users = []

    async with AsyncSessionLocal() as db:
        for p in valid_pending:
            cname = p["clean_name"]
            # 1. Exact unaccent
            res = await db.execute(text("""
                SELECT id, name, crm_id, phone, client_code
                FROM users
                WHERE unaccent(LOWER(TRIM(name))) = unaccent(LOWER(TRIM(:n)))
                LIMIT 1
            """), {"n": cname})
            urow = res.fetchone()

            # 2. If not found, try partial ILIKE
            if not urow:
                res = await db.execute(text("""
                    SELECT id, name, crm_id, phone, client_code
                    FROM users
                    WHERE unaccent(LOWER(name)) LIKE unaccent(LOWER(:like_n))
                    ORDER BY id DESC
                    LIMIT 1
                """), {"like_n": f"%{cname}%"})
                urow = res.fetchone()

            # 3. If not found, try first name + first surname
            if not urow:
                tokens = [t for t in cname.split() if len(t) > 2]
                if len(tokens) >= 2:
                    t1, t2 = tokens[0], tokens[1]
                    res = await db.execute(text("""
                        SELECT id, name, crm_id, phone, client_code
                        FROM users
                        WHERE unaccent(LOWER(name)) LIKE unaccent(LOWER(:t1))
                          AND unaccent(LOWER(name)) LIKE unaccent(LOWER(:t2))
                        ORDER BY id DESC
                        LIMIT 1
                    """), {"t1": f"%{t1}%", "t2": f"%{t2}%"})
                    urow = res.fetchone()

            # 4. If not found, try first name + last token (second surname)
            if not urow and len(tokens) >= 3:
                t1, t_last = tokens[0], tokens[-1]
                res = await db.execute(text("""
                    SELECT id, name, crm_id, phone, client_code
                    FROM users
                    WHERE unaccent(LOWER(name)) LIKE unaccent(LOWER(:t1))
                      AND unaccent(LOWER(name)) LIKE unaccent(LOWER(:t_last))
                    ORDER BY id DESC
                    LIMIT 1
                """), {"t1": f"%{t1}%", "t_last": f"%{t_last}%"})
                urow = res.fetchone()

            if urow:
                matched_users.append({
                    "sheet_row": p["row"],
                    "sheet_name": p["raw_name"],
                    "db_id": urow[0],
                    "db_name": urow[1],
                    "crm_id": urow[2],
                    "phone": urow[3],
                    "client_code": urow[4],
                    "dates_pend": p["dates_pend"],
                    "responsable": p["resp"],
                    "nota": p["nota"]
                })
            else:
                unmatched_users.append({
                    "sheet_row": p["row"],
                    "sheet_name": p["raw_name"],
                    "clean_name": cname,
                    "dates_pend": p["dates_pend"],
                    "responsable": p["resp"],
                    "nota": p["nota"]
                })

    print(f"\n--- RESULTADOS DE BÚSQUEDA EN BASE DE DATOS ---")
    print(f"Total clientes ENCONTRADOS en BD: {len(matched_users)} ({len(matched_users)/len(valid_pending)*100:.1f}%)")
    print(f"Total clientes NO ENCONTRADOS en BD: {len(unmatched_users)} ({len(unmatched_users)/len(valid_pending)*100:.1f}%)")

    print(f"\nPrimeros 10 encontrados:")
    for m in matched_users[:10]:
        print(f"  Fila {m['sheet_row']:3d}: '{m['sheet_name']}' -> DB ID {m['db_id']}: '{m['db_name']}' (CRM: {m['crm_id']})")

    print(f"\nTodos los no encontrados:")
    for u in unmatched_users:
        print(f"  Fila {u['sheet_row']:3d}: '{u['sheet_name']}' (Limpio: '{u['clean_name']}') | Dates: {u['dates_pend']} | Resp: {u['responsable']} | Nota: '{u['nota']}'")

if __name__ == "__main__":
    asyncio.run(main())
