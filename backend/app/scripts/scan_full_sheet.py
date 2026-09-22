import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

creds = service_account.Credentials.from_service_account_file(
    '/app/service_account.json',
    scopes=['https://www.googleapis.com/auth/spreadsheets']
)
service = build('sheets', 'v4', credentials=creds)
sheet_id = '1g2sFJnfn0H9CGSYKLQkGyif2uaRlhim8PKZ0lAb-cfk'

meta = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
for s in meta.get('sheets', []):
    title = s.get('properties', {}).get('title')
    res = service.spreadsheets().values().get(
        spreadsheetId=sheet_id,
        range=f"'{title}'!A1:Z2000"
    ).execute()
    rows = res.get('values', [])
    print(f"Sheet '{title}' has {len(rows)} rows.")

    matches = []
    for r_idx, r in enumerate(rows, start=1):
        for c_idx, cell in enumerate(r):
            val = str(cell)
            if '5 date' in val.lower() or '5 cita' in val.lower() or '5 dates' in val.lower() or '5 citas' in val.lower():
                matches.append((r_idx, c_idx, val))

    print(f"  Matches with '5 date(s)' or '5 cita(s)': {len(matches)}")
    for m in matches[:10]:
        print(f"   - Row {m[0]}, Col {m[1]}: '{m[2][:80]}'")
