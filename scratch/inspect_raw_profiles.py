import openpyxl

wb = openpyxl.load_workbook(r'C:\Users\jeloz\Downloads\Daily Lover MATCHMAKING.xlsx', read_only=True)
ws_prof = wb['PROFILES']

print("=== INSPECTING RECENT PROFILES ROWS (2515 to 2535) ===")
for r_idx, r in enumerate(ws_prof.iter_rows(min_row=2515, max_row=2535, values_only=True), 2515):
    if r and any(r):
        vals = [f"Col{i}:{v}" for i, v in enumerate(r[:15]) if v is not None]
        print(f"Row {r_idx} -> {vals}")
