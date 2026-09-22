import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

creds = service_account.Credentials.from_service_account_file(
    '/app/service_account.json',
    scopes=['https://www.googleapis.com/auth/spreadsheets']
)
service = build('sheets', 'v4', credentials=creds)
sheet_id = '1g2sFJnfn0H9CGSYKLQkGyif2uaRlhim8PKZ0lAb-cfk'

res1 = service.spreadsheets().values().get(
    spreadsheetId=sheet_id,
    range="'Missing Matches'!A1:E705"
).execute()
rows1 = res1.get('values', [])
print(f"Total rows in Missing Matches: {len(rows1)}")

rows_with_5 = []
for idx, r in enumerate(rows1, start=1):
    dates_pend = r[2] if len(r) > 2 else ''
    if '5' in dates_pend:
        rows_with_5.append((idx, r))

print(f"Remaining rows with '5' in Dates Pendientes: {len(rows_with_5)}")
for idx, r in rows_with_5:
    print(f"Row {idx}: {r}")
