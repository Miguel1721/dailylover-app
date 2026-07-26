import openpyxl

wb = openpyxl.load_workbook(r'C:\Users\jeloz\Downloads\Daily Lover MATCHMAKING.xlsx', data_only=True)
ws = wb['MISSING MATCHES']

print("=== INSPECCION DE FECHAS EN MISSING MATCHES ===")
for r_idx, r in enumerate(ws.iter_rows(min_row=1, max_row=40, values_only=True), 1):
    if not r: continue
    for c in r:
        if hasattr(c, 'year'):
            print(f"Fila {r_idx}: Raw Date Object -> {c} | Str: {str(c)}")
