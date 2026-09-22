import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

creds = service_account.Credentials.from_service_account_file(
    '/app/service_account.json',
    scopes=['https://www.googleapis.com/auth/spreadsheets']
)
service = build('sheets', 'v4', credentials=creds)

old_sheet_id = '1tCV7lIE-uypmDELyNz9bWdS95DEzCHO9EUbCszVa9co'
res_old = service.spreadsheets().values().get(
    spreadsheetId=old_sheet_id,
    range="'Missing Matches'!A1:E10"
).execute()
print("OLD SHEET HEADERS:")
for r in res_old.get('values', []):
    print(r)

# In old sheet, column 0 is Resp, col 1 is Fecha, col 2 is FullName, col 3 is Dates Pendientes!
res_old_all = service.spreadsheets().values().get(
    spreadsheetId=old_sheet_id,
    range="'Missing Matches'!A1:E600"
).execute()
old_rows = res_old_all.get('values', [])
print("\nChecking '5' in old sheet:")
for idx, r in enumerate(old_rows, start=1):
    r_str = " | ".join(str(x) for x in r)
    if '5 dates' in r_str.lower() or '5 citas' in r_str.lower():
        print(f"OLD Row {idx}: {r}")

print("\nChecking '2 dates' in old sheet:")
count_2 = 0
for idx, r in enumerate(old_rows, start=1):
    r_str = " | ".join(str(x) for x in r)
    if '2 dates' in r_str.lower() or '2 citas' in r_str.lower():
        count_2 += 1
        if count_2 <= 10:
            print(f"OLD 2 dates Row {idx}: {r}")
print(f"Total rows with 2 dates in old sheet: {count_2}")
