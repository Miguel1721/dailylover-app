import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

creds = service_account.Credentials.from_service_account_file(
    '/app/service_account.json',
    scopes=['https://www.googleapis.com/auth/spreadsheets']
)
service = build('sheets', 'v4', credentials=creds)
sheet_id = '1g2sFJnfn0H9CGSYKLQkGyif2uaRlhim8PKZ0lAb-cfk'

# Find all occurrences of 5 dates / 5 citas in Missing Matches
res1 = service.spreadsheets().values().get(
    spreadsheetId=sheet_id,
    range="'Missing Matches'!A1:E1600"
).execute()
rows1 = res1.get('values', [])

updates = []
for idx, r in enumerate(rows1, start=1):
    dates_pend = r[2] if len(r) > 2 else ''
    if '5' in dates_pend and ('date' in dates_pend.lower() or 'cita' in dates_pend.lower()):
        new_val = dates_pend.replace('5', '2')
        cell_ref = f"'Missing Matches'!C{idx}"
        updates.append({
            "range": cell_ref,
            "values": [[new_val]],
            "old_val": dates_pend,
            "row_idx": idx,
            "name": r[1] if len(r) > 1 else ''
        })

print(f"Total cells to update from 5 to 2 in Missing Matches: {len(updates)}")
for u in updates:
    print(f"Row {u['row_idx']} ({u['range']}): '{u['old_val']}' -> '{u['values'][0][0]}' for client '{u['name']}'")

# Test batch update if any
if updates:
    batch_data = [{"range": u["range"], "values": u["values"]} for u in updates]
    try:
        res = service.spreadsheets().values().batchUpdate(
            spreadsheetId=sheet_id,
            body={"valueInputOption": "USER_ENTERED", "data": batch_data}
        ).execute()
        print(f"\nSUCCESS! Google Sheet updated. Total updated cells: {res.get('totalUpdatedCells')}")
    except Exception as e:
        print(f"\nERROR updating Google Sheet: {e}")
