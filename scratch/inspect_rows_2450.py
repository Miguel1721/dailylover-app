import openpyxl

wb = openpyxl.load_workbook(r'C:\Users\jeloz\Downloads\Daily Lover MATCHMAKING.xlsx', read_only=True)
ws_prof = wb['PROFILES']

print("=== CHECKING ROWS 2450 to 2480 IN PROFILES SHEET ===")
for r_idx, r in enumerate(ws_prof.iter_rows(min_row=2450, max_row=2480, values_only=True), 2450):
    if not r or not r[1]: continue
    name = str(r[1]).strip()
    date_val = str(r[2]) if len(r) > 2 else ""
    resp_val = str(r[3]) if len(r) > 3 else ""
    col4_val = str(r[4]) if len(r) > 4 else ""
    col8_val = str(r[8]) if len(r) > 8 else ""
    print(f"Row {r_idx} | ID: {r[0]} | Name: '{name}' | Col2 (Date): '{date_val}' | Col3 (Resp): '{resp_val}' | Col4 (Text): '{col4_val}' | Col8 (Age): '{col8_val}'")
