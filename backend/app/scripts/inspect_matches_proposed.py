import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

creds = service_account.Credentials.from_service_account_file(
    '/app/service_account.json',
    scopes=['https://www.googleapis.com/auth/spreadsheets']
)
service = build('sheets', 'v4', credentials=creds)
sheet_id = '1g2sFJnfn0H9CGSYKLQkGyif2uaRlhim8PKZ0lAb-cfk'

# Read Matches proposed
res = service.spreadsheets().values().get(
    spreadsheetId=sheet_id,
    range="'Matches proposed'!A1:Z1000"
).execute()
rows = res.get('values', [])
print(f"Total rows in Matches proposed: {len(rows)}")
if rows:
    print(f"Header: {rows[0]}")
    # Find which column has Dates Pendientes or 5 dates
    col_dates_idx = None
    for c_i, col_name in enumerate(rows[0]):
        if 'date' in str(col_name).lower() or 'cita' in str(col_name).lower() or 'pendiente' in str(col_name).lower():
            col_dates_idx = c_i
            print(f"Found column {c_i}: {col_name}")

    count_5 = 0
    for idx, r in enumerate(rows[1:], start=2):
        for c_i, val in enumerate(r):
            if '5' in str(val) and ('date' in str(val).lower() or 'cita' in str(val).lower()):
                count_5 += 1
                print(f"Row {idx}, Col {c_i}: '{val}' (Client: {r[0] if len(r)>0 else ''})")

    print(f"Total matches in 'Matches proposed': {count_5}")
