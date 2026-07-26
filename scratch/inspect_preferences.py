import openpyxl

wb = openpyxl.load_workbook(r'C:\Users\jeloz\Downloads\Daily Lover MATCHMAKING.xlsx', read_only=True)
ws_pref = wb['PREFERENCES']

pref_map = {}
for r in ws_pref.iter_rows(min_row=2, values_only=True):
    if not r or not r[0]: continue
    pid = str(r[0]).strip()
    intent = str(r[1] or '').strip() if len(r) > 1 else ''
    pref_gender = str(r[2] or '').strip() if len(r) > 2 else ''
    age_min = str(r[3] or '').strip() if len(r) > 3 else ''
    age_max = str(r[4] or '').strip() if len(r) > 4 else ''
    values = str(r[6] or '').strip() if len(r) > 6 else ''
    notes = str(r[13] or '').strip() if len(r) > 13 else ''
    red_flags = str(r[14] or '').strip() if len(r) > 14 else ''
    green_flags = str(r[15] or '').strip() if len(r) > 15 else ''
    
    pref_map[pid] = {
        "intent": intent, "pref_gender": pref_gender, "age_range": f"{age_min}-{age_max}",
        "values": values, "notes": notes, "red_flags": red_flags, "green_flags": green_flags
    }

print(f"PREFERENCES FOUND FOR {len(pref_map)} USERS!")
for k, v in list(pref_map.items())[:5]:
    print(f"  ProfileID: {k} -> {v}")
