import openpyxl

wb = openpyxl.load_workbook(r'C:\Users\jeloz\Downloads\Daily Lover MATCHMAKING.xlsx', read_only=True)
ws_prof = wb['PROFILES']

print("=== CHECKING RUBEN ROJA AND CAROLINA DORADO IN PROFILES SHEET ===")
for r_idx, r in enumerate(ws_prof.iter_rows(min_row=2, values_only=True), 2):
    if not r or not r[1]: continue
    name = str(r[1]).strip().lower()
    if 'ruben' in name or 'carolina' in name or 'manuel' in name:
        col4_text = str(r[4] or '').strip()
        print(f"Row {r_idx} | Raw Name: '{r[1]}' | Col 4: '{col4_text}' | Col 8: '{r[8] if len(r) > 8 else None}'")
