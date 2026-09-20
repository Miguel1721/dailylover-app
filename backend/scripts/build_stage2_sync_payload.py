import sys
import os
import json
import re
import unicodedata
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build

sys.stdout.reconfigure(encoding='utf-8')

CREDS_FILE = r"C:\Users\jeloz\Documents\antigravity\zealous-fermi\scratch\service_account.json"
ORIGINAL_SHEET_ID = "113GBaGwDltILH4pMqbyvuK17rhCIxPFW0Cv4sLtBX5A"

def normalize_name(name: str) -> str:
    if not name:
        return ""
    n = unicodedata.normalize('NFD', str(name))
    n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    n = re.sub(r'[^a-zA-Z0-9\s]', ' ', n)
    n = re.sub(r'\s+', ' ', n).strip().lower()
    return n

def clean_str(val: str) -> str:
    if not val:
        return ""
    return str(val).strip()

KNOWN_CITIES = {
    "bogota": "Bogotá", "bogotá": "Bogotá", "bog": "Bogotá", "bgta": "Bogotá", "bgota": "Bogotá",
    "medellin": "Medellín", "medellín": "Medellín", "med": "Medellín",
    "cali": "Cali",
    "barranquilla": "Barranquilla", "baq": "Barranquilla", "bquilla": "Barranquilla", "quilla": "Barranquilla",
    "cartagena": "Cartagena", "ctg": "Cartagena", "ctagena": "Cartagena",
    "bucaramanga": "Bucaramanga", "buca": "Bucaramanga", "bga": "Bucaramanga", "bmanga": "Bucaramanga", "bcamanga": "Bucaramanga",
    "pereira": "Pereira", "perei": "Pereira", "peira": "Pereira",
    "manizales": "Manizales", "mani": "Manizales",
    "santa marta": "Santa Marta", "smr": "Santa Marta", "sta marta": "Santa Marta",
    "miami": "Miami", "mia": "Miami",
    "cucuta": "Cúcuta", "cúcuta": "Cúcuta",
    "ibague": "Ibagué", "ibagué": "Ibagué", "ibag": "Ibagué",
    "chia": "Chía", "chía": "Chía",
    "cajica": "Cajicá", "cajicá": "Cajicá",
    "tunja": "Tunja",
    "armenia": "Armenia",
    "monteria": "Montería", "montería": "Montería",
    "neiva": "Neiva",
    "madrid": "Madrid", "mad": "Madrid",
    "cdmx": "Ciudad de México", "mexico": "Ciudad de México", "méxico": "Ciudad de México", "ciudad de méxico": "Ciudad de México",
    "dallas": "Dallas",
    "panama": "Panamá", "panamá": "Panamá",
    "zipaquira": "Zipaquirá", "zipaquirá": "Zipaquirá",
    "envigado": "Envigado",
    "sabaneta": "Sabaneta",
    "bello": "Bello",
    "villavicencio": "Villavicencio",
    "popayan": "Popayán", "popayán": "Popayán",
    "pasto": "Pasto",
    "valledupar": "Valledupar",
    "choconta": "Chocontá", "chocontá": "Chocontá",
    "la calera": "La Calera",
    "sopo": "Sopó", "sopó": "Sopó",
    "duitama": "Duitama",
    "tocancipa": "Tocancipá", "tocancipá": "Tocancipá",
    "facatativa": "Facatativá", "facatativá": "Facatativá",
    "funza": "Funza",
    "barbosa": "Barbosa",
    "la dorada": "La Dorada",
    "palmira": "Palmira",
    "floridablanca": "Floridablanca"
}

NOISE_WORDS = [
    'date', 'citas', 'cita', 'pagar', 'paga', 'cobrar', 'restaurante', 'gluten', 
    'alergico', 'alérgico', 'feedback', 'hora', 'minutos', 'alerta', 'reserva', 
    'debe', 'abogado', 'slots', 'cliente', 'despues', 'después', 'yes', 'no', 
    'si', 'sí', 'true', 'false', 'n/a', 'na', 'none', 'null', 'col', 'colombia', 
    'vip', 'historico', 'histórico', 'gay', 'gays', 'lesb', 'lesbiana', 'lesbianas',
    '300k', '40k', '65k', '98k', '150k', '195k', 'brunch', 'virtual'
]


def normalize_city(city_raw: str):
    if not city_raw:
        return None
    c = clean_str(city_raw).lower()
    if not c or len(c) < 3 or len(c) > 35:
        return None
    
    for noise in NOISE_WORDS:
        if re.search(r'\b' + re.escape(noise) + r'\b', c) or c == noise:
            return None
            
    if re.search(r'^\d+', c) or 'años' in c or 'anios' in c:
        return None
        
    if c in KNOWN_CITIES:
        return KNOWN_CITIES[c]
        
    for k in sorted(KNOWN_CITIES.keys(), key=len, reverse=True):
        if len(k) >= 3 and k in c:
            return KNOWN_CITIES[k]
            
    return None


STATUS_MAPPING = {
    "APROBADO": "APROBADO",
    "DONEEEEE": "APROBADO",
    "NOT APPROVED": "NOT APPROVED",
    "NO ACCEPT": "NOT APPROVED",
    "TROUBLE": "TROUBLE",
    "TROUBLEMAKER": "TROUBLE",
    "NO HAY GENTE": "NO HAY GENTE",
    "LISTO PARA MATCH": "Listo para match",
    "REFUND": "REFUND",
    "REFUND DONE": "REFUND",
    "REVISAR": "REVISAR",
    "AYUDA": "REVISAR",
    "REVISAR POR SI TOCA OTRO MATCH": "REVISAR",
    "REQUEST PROFILE UPDATE": "REVISAR",
    "NO MATCH/CAMBIAR": "NO MATCH/CAMBIAR",
    "HACER OTRO MATCH": "NO MATCH/CAMBIAR",
    "HECHO POR MAPE": "HECHO POR MAPE",
    "HECHO": "HECHO POR MAPE",
    "DESCALIFICADO": "DESCALIFICADO",
    "INACTIVO": "INACTIVO",
    "EN PAUSA EL PROCESO": "INACTIVO",
    "MATCH DONE": "MATCH DONE",
    "YA SALIERON": "MATCH DONE",
    "HISTORIAL": "ARCHIVADO",
    "ARCHIVADO": "ARCHIVADO",
    "EN ESPERA": "REVISAR",
    "PENDIENTE": "REVISAR",
    "LLEVAR A MATCHMAKING": "Listo para match",
    "MUJER +50": "REVISAR"
}

def normalize_status(st_raw: str) -> str:
    s = clean_str(st_raw).upper()
    if not s:
        return "Listo para match"
    return STATUS_MAPPING.get(s, clean_str(st_raw))

print("1. Conectando a Google Sheets API (STRICT READONLY)...")
creds = service_account.Credentials.from_service_account_file(
    CREDS_FILE,
    scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
)
service = build('sheets', 'v4', credentials=creds)

# -------------------------------------------------------------
# FASE 1: CLIENTES Y PERFILES
# -------------------------------------------------------------
print("\n2. Leyendo datos de Clientes (PROFILES, Clients plans, PREFERENCES, 650k, PERSONAS DÍFICILES)...")

# A. PROFILES
res_prof = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range="'PROFILES'!A1:ZZ5000").execute()
rows_prof = res_prof.get('values', [])
profiles_list = []
for idx, r in enumerate(rows_prof[1:], start=2):
    if not r or not any(clean_str(c) for c in r):
        continue
    no_val = clean_str(r[0]) if len(r) > 0 else ""
    name_val = clean_str(r[1]) if len(r) > 1 else ""
    fecha_val = clean_str(r[2]) if len(r) > 2 else ""
    resp_val = clean_str(r[3]) if len(r) > 3 else ""
    city_age = clean_str(r[4]) if len(r) > 4 else ""
    if name_val:
        profiles_list.append({
            "no": no_val,
            "name": name_val,
            "norm_name": normalize_name(name_val),
            "fecha": fecha_val,
            "responsable": resp_val,
            "ciudad_anos": city_age,
            "row": idx
        })
print(f"   -> Clientes en PROFILES: {len(profiles_list)}")

# B. Clients plans (Emails and Plan tiers)
res_plans = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range="'Clients plans'!A1:ZZ1000").execute()
rows_plans = res_plans.get('values', [])
plans_by_name = {}
plans_by_email = {}
if rows_plans:
    headers_plans = rows_plans[0]
    for r in rows_plans[1:]:
        for col_idx in range(0, len(r), 2):
            c_name = clean_str(r[col_idx]) if col_idx < len(r) else ""
            c_email = clean_str(r[col_idx+1]) if col_idx+1 < len(r) else ""
            plan_header = clean_str(headers_plans[col_idx]) if col_idx < len(headers_plans) else "Desconocido"
            norm_nm = normalize_name(c_name)
            if norm_nm:
                plans_by_name[norm_nm] = {
                    "name": c_name,
                    "email": c_email,
                    "plan": plan_header
                }
            if c_email and "@" in c_email:
                plans_by_email[c_email.lower()] = {
                    "name": c_name,
                    "email": c_email,
                    "plan": plan_header
                }
print(f"   -> Clientes con plan/email: {len(plans_by_name)} por nombre, {len(plans_by_email)} por email")

# C. PREFERENCES
res_pref = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range="'PREFERENCES'!A1:ZZ1000").execute()
rows_pref = res_pref.get('values', [])
pref_by_profile_id = {}
if rows_pref:
    pref_headers = [clean_str(h) for h in rows_pref[0]]
    for r in rows_pref[1:]:
        if not r or not clean_str(r[0]):
            continue
        pid = clean_str(r[0])
        pref_dict = {}
        for c_idx, val in enumerate(r):
            if c_idx < len(pref_headers) and clean_str(val):
                pref_dict[pref_headers[c_idx]] = clean_str(val)
        pref_by_profile_id[pid] = pref_dict
print(f"   -> Perfiles con PREFERENCES estructuradas: {len(pref_by_profile_id)}")

# D. PERSONAS DÍFICILES
res_dif = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range="'PERSONAS DÍFICILES'!A1:ZZ500").execute()
rows_dif = res_dif.get('values', [])
difficult_by_name = {}
for r in rows_dif[1:]:
    if r and clean_str(r[0]):
        nm = clean_str(r[0])
        obs = clean_str(r[2]) if len(r) > 2 else ""
        st = clean_str(r[3]) if len(r) > 3 else ""
        difficult_by_name[normalize_name(nm)] = {
            "notes": f"{obs} ({st})".strip(),
            "interviewer": clean_str(r[1]) if len(r) > 1 else ""
        }
print(f"   -> Clientes en PERSONAS DÍFICILES: {len(difficult_by_name)}")

# E. 650 k
res_650 = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range="'650 k'!A1:ZZ50").execute()
rows_650 = res_650.get('values', [])
vip_650_by_name = {}
for r in rows_650[1:12]: # Top clients section
    if r and len(r) > 2 and clean_str(r[2]):
        nm = clean_str(r[2])
        vip_650_by_name[normalize_name(nm)] = {
            "no": clean_str(r[0]),
            "date": clean_str(r[1]),
            "interviewer": clean_str(r[3]) or "MPS",
            "notes": clean_str(r[5]) if len(r) > 5 else ""
        }
print(f"   -> Clientes en Plan 650k (MPS): {len(vip_650_by_name)}")

# Combine into consolidated client records
consolidated_clients = []
for p in profiles_list:
    n_nm = p["norm_name"]
    plan_info = plans_by_name.get(n_nm, {})
    pref_info = pref_by_profile_id.get(p["no"], {})
    diff_info = difficult_by_name.get(n_nm, {})
    vip_info = vip_650_by_name.get(n_nm, {})
    
    plan_tier = "Plan 650k (MPS)" if vip_info else (plan_info.get("plan") or None)
    responsable = vip_info.get("interviewer") if vip_info else (p["responsable"] or None)
    email = plan_info.get("email") or ""
    is_difficult = bool(diff_info)
    difficult_notes = diff_info.get("notes") or ""
    
    consolidated_clients.append({
        "client_code": p["no"],
        "name": p["name"],
        "norm_name": n_nm,
        "email": email,
        "responsable": responsable,
        "city": normalize_city(p["ciudad_anos"]),
        "plan_tier": plan_tier,
        "search_preferences": pref_info,
        "is_difficult": is_difficult,
        "difficult_notes": difficult_notes,
        "created_at_str": p["fecha"]
    })

# Add any clients in Clients plans not in PROFILES
existing_norm_names = set(c["norm_name"] for c in consolidated_clients)
for n_nm, pl in plans_by_name.items():
    if n_nm not in existing_norm_names and len(n_nm) > 2:
        consolidated_clients.append({
            "client_code": "",
            "name": pl["name"],
            "norm_name": n_nm,
            "email": pl["email"],
            "responsable": None,
            "city": None,
            "plan_tier": pl.get("plan") or None,
            "search_preferences": {},
            "is_difficult": False,
            "difficult_notes": "",
            "created_at_str": ""
        })
        existing_norm_names.add(n_nm)

print(f"Total clientes consolidados listos para sincronización: {len(consolidated_clients)}")

# -------------------------------------------------------------
# FASE 2: MESAS DE PSICÓLOGAS (operational_matches)
# -------------------------------------------------------------
psyc_tabs = [
    ("MATCHES JENN", "JENN"),
    ("MATCHES SILVI", "SILVI"),
    ("MATCHES ANA ", "ANA"),
    ("MATCHES STEFFY", "STEFFY"),
    ("MATCHES ALEJA", "ALEJA"),
    ("MATCHES SOFI", "SOFI"),
    ("MATCHES LAU", "LAU"),
    ("MATCHES MAPE D", "MAPE D"),
    ("MATCHES MANU ", "MANU"),
    ("MATCHES ISA", "ISA"),
    ("MATCHES PIA", "PIA")
]

all_operational_matches = []

for tab_name, psyc_code in psyc_tabs:
    res = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range=f"'{tab_name}'!A1:ZZ2000").execute()
    rows = res.get('values', [])
    if not rows:
        continue
    
    headers = [clean_str(c).upper() for c in rows[0]]
    
    # Dynamic header search
    pA_idx, pB_idx, st_idx, obs_idx, city_idx, pref_idx, plan_idx, date_idx, slot_idx = -1, -1, -1, -1, -1, -1, -1, -1, -1
    for i, h in enumerate(headers):
        if "PERSON A" in h or "PERSONA A" in h or h == "ADRIANA VIVAS":
            pA_idx = i
        elif "PERSON B" in h or "PERSONA B" in h:
            pB_idx = i
        elif "STATUS" in h or "ESTADO" in h:
            st_idx = i
        elif "OBS" in h or "NOTAS" in h or "OBSERVACIONES" in h:
            obs_idx = i
        elif "CITY" in h or "CIUDAD" in h:
            city_idx = i
        elif "PREF" in h:
            pref_idx = i
        elif "PLAN" in h:
            plan_idx = i
        elif "FECHA" in h or "DATE" in h or "DÍA" in h:
            date_idx = i
        elif "ID" in h:
            slot_idx = i
            
    # Fallback for MATCHES LAU
    if tab_name == "MATCHES LAU":
        pA_idx = 0
        pB_idx = 1
        obs_idx = 2
        
    start_row = 1
    # Skip tasks in LAU
    if tab_name == "MATCHES LAU":
        start_row = 3
        
    tab_count = 0
    for r_num, r in enumerate(rows[start_row:], start=start_row+1):
        if not r or not any(clean_str(c) for c in r):
            continue
        pA = clean_str(r[pA_idx]) if pA_idx != -1 and len(r) > pA_idx else ""
        pB = clean_str(r[pB_idx]) if pB_idx != -1 and len(r) > pB_idx else ""
        
        # Must have at least Persona A
        if not pA or pA.lower() in ("person a", "persona a", "tasks", "nombre"):
            continue
            
        st_raw = clean_str(r[st_idx]) if st_idx != -1 and len(r) > st_idx else ""
        obs = clean_str(r[obs_idx]) if obs_idx != -1 and len(r) > obs_idx else ""
        city_raw = clean_str(r[city_idx]) if city_idx != -1 and len(r) > city_idx else ""
        pref = clean_str(r[pref_idx]) if pref_idx != -1 and len(r) > pref_idx else ""
        plan = clean_str(r[plan_idx]) if plan_idx != -1 and len(r) > plan_idx else ""
        dt_raw = clean_str(r[date_idx]) if date_idx != -1 and len(r) > date_idx else ""
        
        slot_raw = clean_str(r[slot_idx]) if slot_idx != -1 and len(r) > slot_idx else ""
        try:
            slot_num = int(slot_raw)
        except Exception:
            slot_num = None
            
        norm_st = normalize_status(st_raw)
        city_norm = normalize_city(city_raw)
        
        all_operational_matches.append({
            "tab": tab_name,
            "psychologist_name": psyc_code,
            "row": r_num,
            "person_a": pA,
            "person_b": pB,
            "city": city_norm,
            "pref": pref,
            "plan_tier": plan,
            "status": norm_st,
            "status_raw": st_raw,
            "observations": obs,
            "date_raw": dt_raw,
            "slot_number": slot_num,
            "approved_by_maria": (norm_st == "APROBADO")
        })
        tab_count += 1
        
    print(f"   -> {tab_name} ({psyc_code}): {tab_count} matches procesados")

print(f"Total operational_matches recolectados: {len(all_operational_matches)}")

# -------------------------------------------------------------
# FASE 3: MESA CANÓNICA GENERAL (MATCHES)
# -------------------------------------------------------------
print("\n3. Leyendo pestaña canónica 'MATCHES'...")
res_matches = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range="'MATCHES'!A1:ZZ3000").execute()
rows_m = res_matches.get('values', [])
canonical_matches = []
if rows_m:
    # Fila 1: persona A, Plan B, PERSONA A, PERSONA B, DÍA, LUGAR, CIUDAD, RESERVA, CONFIRMACIÓN, DIA ANTES, HOY, PRESUPUESTO, MATCH, '', ELLA
    for r_num, r in enumerate(rows_m[1:], start=2):
        if not r or not any(clean_str(c) for c in r):
            continue
        pA = clean_str(r[2]) if len(r) > 2 else ""
        pB = clean_str(r[3]) if len(r) > 3 else ""
        if not pA or pA.lower() in ("persona a", "person a"):
            continue
            
        dia_hora = clean_str(r[4]) if len(r) > 4 else ""
        lugar = clean_str(r[5]) if len(r) > 5 else ""
        ciudad = normalize_city(clean_str(r[6]) if len(r) > 6 else "")
        reserva = clean_str(r[7]) if len(r) > 7 else ""
        conf = clean_str(r[8]) if len(r) > 8 else ""
        dia_antes = clean_str(r[9]) if len(r) > 9 else ""
        hoy = clean_str(r[10]) if len(r) > 10 else ""
        presupuesto = clean_str(r[11]) if len(r) > 11 else ""
        match_res = clean_str(r[12]) if len(r) > 12 else ""
        ella_notes = clean_str(r[14]) if len(r) > 14 else ""
        
        canonical_matches.append({
            "row": r_num,
            "person_a": pA,
            "person_b": pB,
            "date_time": dia_hora,
            "venue": lugar,
            "city": ciudad,
            "reservation_confirmed": reserva.lower() in ("yes", "si", "sí"),
            "confirmation_status": conf,
            "day_before_status": dia_antes,
            "today_status": hoy,
            "budget": presupuesto,
            "match_result": match_res,
            "feedback_ella": ella_notes
        })
print(f"   -> Registros en mesa canónica MATCHES: {len(canonical_matches)}")

# -------------------------------------------------------------
# FASE 4: TABLAS ESPECIALES (TROUBLE MATCHES, ENAMORADOS, etc.)
# -------------------------------------------------------------
print("\n4. Leyendo tablas especiales (TROUBLE MATCHES, ENAMORADOS)...")

# TROUBLE MATCHES
res_tr = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range="'TROUBLE MATCHES'!A1:ZZ2000").execute()
rows_tr = res_tr.get('values', [])
trouble_records = []
if rows_tr:
    # ['', 'PERSONA A', 'PERSON B', 'REASON', 'NOTA']
    for r in rows_tr[1:]:
        pA = clean_str(r[1]) if len(r) > 1 else ""
        pB = clean_str(r[2]) if len(r) > 2 else ""
        reason = clean_str(r[3]) if len(r) > 3 else ""
        nota = clean_str(r[4]) if len(r) > 4 else ""
        if pA:
            trouble_records.append({
                "person_a": pA,
                "person_b": pB,
                "reason": reason,
                "notes": nota
            })
print(f"   -> Casos en TROUBLE MATCHES: {len(trouble_records)}")

# ENAMORADOS
res_en = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range="'ENAMORADOS'!A1:ZZ100").execute()
rows_en = res_en.get('values', [])
enamorados_records = []
if rows_en:
    # ['FECHA CUADRE', 'PERSONA A', 'PERSONA B', 'TIEMPO ENAMORADOS', 'Nota', 'Matcmaker']
    for r in rows_en[1:]:
        dt = clean_str(r[0]) if len(r) > 0 else ""
        pA = clean_str(r[1]) if len(r) > 1 else ""
        pB = clean_str(r[2]) if len(r) > 2 else ""
        tiempo = clean_str(r[3]) if len(r) > 3 else ""
        nota = clean_str(r[4]) if len(r) > 4 else ""
        mm = clean_str(r[5]) if len(r) > 5 else ""
        if pA and pB:
            enamorados_records.append({
                "person_a": pA,
                "person_b": pB,
                "match_date": dt,
                "time_in_love": tiempo,
                "notes": nota,
                "matchmaker": mm
            })
print(f"   -> Parejas en ENAMORADOS: {len(enamorados_records)}")

# Export all payloads to scratch directory
out_payload = {
    "generated_at": datetime.now().isoformat(),
    "spreadsheet_id": ORIGINAL_SHEET_ID,
    "clients": consolidated_clients,
    "operational_matches": all_operational_matches,
    "canonical_matches": canonical_matches,
    "trouble_matches": trouble_records,
    "enamorados": enamorados_records
}

payload_file = r"C:\Users\jeloz\.gemini\antigravity\brain\b1416e31-a60d-4e5d-b2e9-d22c8bda4045\scratch\stage2_full_payload.json"
with open(payload_file, "w", encoding="utf-8") as f:
    json.dump(out_payload, f, indent=2, ensure_ascii=False)

print(f"\n✅ Payload completo de Etapa 2 empaquetado exitosamente en:\n   {payload_file}")
print(f"   Tamaño del paquete: {round(os.path.getsize(payload_file) / 1024, 2)} KB")
