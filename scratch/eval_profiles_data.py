import openpyxl

wb = openpyxl.load_workbook(r'C:\Users\jeloz\Downloads\Daily Lover MATCHMAKING.xlsx', read_only=True)
ws_prof = wb['PROFILES']

total_profiles = 0
with_age_col8 = 0
with_col4_text = 0
with_date_col2 = 0

for r in ws_prof.iter_rows(min_row=2, values_only=True):
    if not r or not r[1]: continue
    total_profiles += 1
    if len(r) > 8 and r[8] is not None and str(r[8]).strip() != '':
        with_age_col8 += 1
    if len(r) > 4 and r[4] is not None and str(r[4]).strip() != '':
        with_col4_text += 1
    if len(r) > 2 and r[2] is not None and str(r[2]).strip() != '':
        with_date_col2 += 1

print(f"TOTAL PROFILES: {total_profiles}")
print(f"WITH AGE IN COL 8 (OFICIAL): {with_age_col8} ({with_age_col8/total_profiles*100:.1f}%)")
print(f"WITH TEXT IN COL 4 (NOTAS/CIUDAD): {with_col4_text} ({with_col4_text/total_profiles*100:.1f}%)")
print(f"WITH DATE IN COL 2 (FECHA INGRESO EXCEL): {with_date_col2} ({with_date_col2/total_profiles*100:.1f}%)")
