#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Daily Lover - Sincronización Integral Diaria y Automática (Google Sheet -> PostgreSQL)
Etapa 3 - Tarea programada (Cron VPS)

Reglas Críticas:
1. STRICT READ-ONLY: Google Sheet se consulta exclusivamente con alcance 'spreadsheets.readonly'.
   Bajo ninguna circunstancia se escribe en el Sheet original.
2. FAIL-SAFE: Verificación de integridad de datos antes de tocar la base de datos.
   Si las filas leídas son anómalas o vacías, aborta inmediatamente sin alterar PostgreSQL.
3. UPSERT IDEMPOTENTE: Preserva 100% de los textos clínicos, vínculos y citas existentes.
4. ESTADO Y TRAZABILIDAD: Registra timestamp UTC, conteos de filas, tiempo y backup previo
   en sync_sheet_status.json para consulta por el endpoint /api/v1/admin/diagnostics.
"""

import sys
import os
import json
import time
import asyncio
from datetime import datetime, timezone
import unicodedata
import re
import uuid

from google.oauth2 import service_account
from googleapiclient.discovery import build
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

sys.stdout.reconfigure(encoding='utf-8')

ORIGINAL_SHEET_ID = os.getenv("ORIGINAL_SHEET_ID", "113GBaGwDltILH4pMqbyvuK17rhCIxPFW0Cv4sLtBX5A")

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://postgres:your_secure_postgres_password@dl_postgres:5432/dailylover"
)

PRE_SYNC_BACKUP_FILE = os.getenv("PRE_SYNC_BACKUP_FILE", None)

CANDIDATE_CREDS_FILES = [
    os.getenv("GOOGLE_SHEETS_CREDENTIALS_FILE", ""),
    "/app/service_account.json",
    "/home/ubuntu/dailylover/backend/service_account.json",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../service_account.json")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../scratch/service_account.json")),
    r"C:\Users\jeloz\Documents\antigravity\zealous-fermi\scratch\service_account.json"
]

CANDIDATE_STATUS_OUTPUTS = [
    "/app/sync_sheet_status.json",
    "/home/ubuntu/dailylover/backend/sync_sheet_status.json",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../sync_sheet_status.json")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../sync_sheet_status.json"))
]


def resolve_creds_file() -> str:
    for p in CANDIDATE_CREDS_FILES:
        if p and os.path.isfile(p):
            return p
    raise FileNotFoundError("No se encontró el archivo de credenciales de Google service_account.json en ninguna ruta conocida.")


def save_status(status_data: dict):
    for target in CANDIDATE_STATUS_OUTPUTS:
        try:
            target_dir = os.path.dirname(target)
            if target_dir and not os.path.exists(target_dir):
                os.makedirs(target_dir, exist_ok=True)
            with open(target, "w", encoding="utf-8") as f:
                json.dump(status_data, f, indent=2, ensure_ascii=False)
            break
        except Exception:
            continue


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


def fetch_sheet_data(creds_path: str) -> dict:
    """Extrae datos directamente del Google Sheet en modo estricto READ-ONLY."""
    print(f"-> Conectando a Google Sheets API (STRICT READONLY)...")
    print(f"   Credenciales: {creds_path}")
    print(f"   Sheet ID: {ORIGINAL_SHEET_ID}")
    
    creds = service_account.Credentials.from_service_account_file(
        creds_path,
        scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
    )
    service = build('sheets', 'v4', credentials=creds, cache_discovery=False)

    # 1. PROFILES
    print("   [1/8] Leyendo PROFILES...")
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
    print(f"         Total perfiles en PROFILES: {len(profiles_list)}")

    # 2. Clients plans
    print("   [2/8] Leyendo Clients plans...")
    res_plans = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range="'Clients plans'!A1:ZZ1000").execute()
    rows_plans = res_plans.get('values', [])
    plans_by_name = {}
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

    # 3. PREFERENCES
    print("   [3/8] Leyendo PREFERENCES...")
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

    # 4. PERSONAS DÍFICILES
    print("   [4/8] Leyendo PERSONAS DÍFICILES...")
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

    # 5. 650 k (VIP MPS)
    print("   [5/8] Leyendo 650 k...")
    res_650 = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range="'650 k'!A1:ZZ50").execute()
    rows_650 = res_650.get('values', [])
    vip_650_by_name = {}
    for r in rows_650[1:12]:
        if r and len(r) > 2 and clean_str(r[2]):
            nm = clean_str(r[2])
            vip_650_by_name[normalize_name(nm)] = {
                "no": clean_str(r[0]),
                "date": clean_str(r[1]),
                "interviewer": clean_str(r[3]) or "MPS",
                "notes": clean_str(r[5]) if len(r) > 5 else ""
            }

    # Consolidar clientes
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

    # 6. Mesas de Psicólogas
    print("   [6/8] Leyendo pestañas de psicólogas...")
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
        try:
            res = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range=f"'{tab_name}'!A1:ZZ2000").execute()
            rows = res.get('values', [])
            if not rows:
                continue
            
            headers = [clean_str(c).upper() for c in rows[0]]
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
                    
            if tab_name == "MATCHES LAU":
                pA_idx, pB_idx, obs_idx = 0, 1, 2
                
            start_row = 3 if tab_name == "MATCHES LAU" else 1
            for r_num, r in enumerate(rows[start_row:], start=start_row+1):
                if not r or not any(clean_str(c) for c in r):
                    continue
                pA = clean_str(r[pA_idx]) if pA_idx != -1 and len(r) > pA_idx else ""
                pB = clean_str(r[pB_idx]) if pB_idx != -1 and len(r) > pB_idx else ""
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
        except Exception as ex_tab:
            print(f"      [WARN] Pestaña {tab_name} omitida o con error: {ex_tab}")

    # 7. Mesa canónica MATCHES
    print("   [7/8] Leyendo mesa canónica 'MATCHES'...")
    res_matches = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range="'MATCHES'!A1:ZZ3000").execute()
    rows_m = res_matches.get('values', [])
    canonical_matches = []
    if rows_m:
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

    # 8. TROUBLE MATCHES y ENAMORADOS
    print("   [8/8] Leyendo TROUBLE MATCHES y ENAMORADOS...")
    res_tr = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range="'TROUBLE MATCHES'!A1:ZZ2000").execute()
    rows_tr = res_tr.get('values', [])
    trouble_records = []
    if rows_tr:
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

    res_en = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SHEET_ID, range="'ENAMORADOS'!A1:ZZ100").execute()
    rows_en = res_en.get('values', [])
    enamorados_records = []
    if rows_en:
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

    return {
        "clients": consolidated_clients,
        "operational_matches": all_operational_matches,
        "canonical_matches": canonical_matches,
        "trouble_matches": trouble_records,
        "enamorados": enamorados_records
    }


async def run_sync():
    start_time = time.time()
    now_utc = datetime.now(timezone.utc).isoformat()
    print("=" * 70)
    print("INICIANDO SINCRONIZACIÓN AUTOMÁTICA DIARIA (Etapa 3: Sheet -> PostgreSQL)")
    print(f"Timestamp UTC: {now_utc}")
    print("=" * 70)

    # 1. Obtener datos (directo de Google Sheets o desde archivo payload si se pasa como arg)
    payload_data = None
    if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]):
        payload_file = sys.argv[1]
        print(f"Cargando payload local desde archivo: {payload_file}")
        with open(payload_file, "r", encoding="utf-8") as f:
            payload_data = json.load(f)
    else:
        try:
            creds_file = resolve_creds_file()
            payload_data = fetch_sheet_data(creds_file)
        except Exception as e:
            err_msg = f"Error fatal obteniendo datos de Google Sheets: {str(e)}"
            print(f"[ERROR CRÍTICO] {err_msg}")
            save_status({
                "status": "error",
                "last_successful_sync": None,
                "last_attempt_utc": now_utc,
                "backup_file": PRE_SYNC_BACKUP_FILE,
                "last_error": err_msg
            })
            sys.exit(1)

    clients = payload_data.get("clients", [])
    op_matches = payload_data.get("operational_matches", [])
    canonical_matches = payload_data.get("canonical_matches", [])
    trouble_matches = payload_data.get("trouble_matches", [])
    enamorados = payload_data.get("enamorados", [])

    print(f"\nResumen de datos leídos del Google Sheet:")
    print(f"   -> Clientes a sincronizar:     {len(clients)}")
    print(f"   -> Matches mesas psicólogas:  {len(op_matches)}")
    print(f"   -> Citas mesa canónica:        {len(canonical_matches)}")
    print(f"   -> Casos Trouble Matches:      {len(trouble_matches)}")
    print(f"   -> Parejas Enamorados:         {len(enamorados)}")

    # 2. FAIL-SAFE AUDIT: Validación de integridad mínima para evitar borrados o corrupciones
    MIN_CLIENTS = 500
    MIN_OP_MATCHES = 500
    MIN_CANONICAL = 200
    if len(clients) < MIN_CLIENTS or len(op_matches) < MIN_OP_MATCHES or len(canonical_matches) < MIN_CANONICAL:
        err_msg = (
            f"Fallo de integridad Fail-Safe: Conteo de filas sospechosamente bajo "
            f"(clients={len(clients)}/{MIN_CLIENTS}, op_matches={len(op_matches)}/{MIN_OP_MATCHES}, "
            f"canonical={len(canonical_matches)}/{MIN_CANONICAL}). ABORTANDO SIN MODIFICAR BASE DE DATOS."
        )
        print(f"\n[ALERTA DE SEGURIDAD] {err_msg}")
        save_status({
            "status": "error",
            "last_successful_sync": None,
            "last_attempt_utc": now_utc,
            "backup_file": PRE_SYNC_BACKUP_FILE,
            "last_error": err_msg
        })
        sys.exit(1)

    # 3. Conexión a Base de Datos
    print(f"\nConectando a PostgreSQL...")
    engine = create_async_engine(DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    users_updated = 0
    users_inserted = 0
    profiles_updated = 0
    profiles_inserted = 0
    om_updated = 0
    om_inserted = 0
    sched_updated = 0
    sched_inserted = 0

    try:
        async with AsyncSessionLocal() as session:
            # Métricas previas
            res_u_before = (await session.execute(text("SELECT COUNT(*) FROM users;"))).scalar()
            res_p_before = (await session.execute(text("SELECT COUNT(*) FROM profiles;"))).scalar()
            res_om_before = (await session.execute(text("SELECT COUNT(*) FROM operational_matches;"))).scalar()
            res_sd_before = (await session.execute(text("SELECT COUNT(*) FROM scheduled_dates;"))).scalar()

            print(f"Estado de tablas antes de sincronizar:")
            print(f"   - users: {res_u_before} | profiles: {res_p_before} | op_matches: {res_om_before} | dates: {res_sd_before}")

            # -------------------------------------------------------------
            # A. CLIENTES Y PERFILES
            # -------------------------------------------------------------
            print("\n[FASE 1/4] Upsert de Clientes y Perfiles...")
            users_res = await session.execute(text("SELECT id, name, email, client_code, crm_id FROM users;"))
            existing_users = users_res.fetchall()
            user_by_norm_name = {}
            user_by_code = {}
            for u in existing_users:
                u_id, u_name, u_email, u_code, u_crm = u
                if u_name:
                    user_by_norm_name[normalize_name(u_name)] = u_id
                if u_code:
                    user_by_code[str(u_code).strip().upper()] = u_id
                if u_crm:
                    user_by_code[str(u_crm).strip().upper()] = u_id

            prof_res = await session.execute(text("SELECT user_id FROM profiles;"))
            existing_prof_user_ids = set(r[0] for r in prof_res.fetchall())

            for c in clients:
                c_name = c["name"]
                c_norm = c["norm_name"]
                c_code = c.get("client_code") or ""
                c_email = c.get("email") or ""
                c_resp = c.get("responsable") or None
                c_city = c.get("city") or None
                c_plan = c.get("plan_tier") or None
                c_diff = c.get("is_difficult", False)
                c_diff_notes = c.get("difficult_notes") or ""
                c_pref = json.dumps(c.get("search_preferences") or {}, ensure_ascii=False)

                user_id = user_by_norm_name.get(c_norm) or (user_by_code.get(c_code.upper()) if c_code else None)

                if user_id:
                    if c_email:
                        await session.execute(
                            text("""
                                UPDATE users 
                                SET email = COALESCE(NULLIF(:email, ''), email),
                                    client_code = COALESCE(NULLIF(client_code, ''), :code)
                                WHERE id = :uid
                            """),
                            {"email": c_email, "code": c_code, "uid": user_id}
                        )
                        users_updated += 1

                    if user_id in existing_prof_user_ids:
                        await session.execute(
                            text("""
                                UPDATE profiles
                                SET responsable = :resp,
                                    city = :city,
                                    plan_tier = COALESCE(:plan, plan_tier),
                                    is_difficult = :diff,
                                    difficult_notes = COALESCE(NULLIF(:d_notes, ''), difficult_notes),
                                    search_preferences = CASE WHEN CAST(:pref AS text) != '{}' THEN CAST(:pref AS jsonb) ELSE search_preferences END,
                                    updated_at = NOW()
                                WHERE user_id = :uid
                            """),
                            {
                                "resp": c_resp, "city": c_city, "plan": c_plan,
                                "diff": c_diff, "d_notes": c_diff_notes, "pref": c_pref,
                                "uid": user_id
                            }
                        )
                        profiles_updated += 1
                    else:
                        await session.execute(
                            text("""
                                INSERT INTO profiles (
                                    user_id, full_name_raw, responsable, city, plan_tier, 
                                    is_difficult, difficult_notes, search_preferences, updated_at
                                ) VALUES (
                                    :uid, :name, :resp, :city, :plan,
                                    :diff, :d_notes, CAST(:pref AS jsonb), NOW()
                                )
                            """),
                            {
                                "uid": user_id, "name": c_name, "resp": c_resp,
                                "city": c_city, "plan": c_plan, "diff": c_diff,
                                "d_notes": c_diff_notes, "pref": c_pref
                            }
                        )
                        existing_prof_user_ids.add(user_id)
                        profiles_inserted += 1
                else:
                    placeholder_phone = f"GEN_{uuid.uuid4().hex[:12]}"
                    insert_u = await session.execute(
                        text("""
                            INSERT INTO users (name, phone, email, client_code, created_at)
                            VALUES (:name, :phone, :email, :code, NOW())
                            RETURNING id;
                        """),
                        {"name": c_name, "phone": placeholder_phone, "email": c_email or None, "code": c_code or None}
                    )
                    new_uid = insert_u.scalar()
                    user_by_norm_name[c_norm] = new_uid
                    if c_code:
                        user_by_code[c_code.upper()] = new_uid
                    users_inserted += 1

                    await session.execute(
                        text("""
                            INSERT INTO profiles (
                                user_id, full_name_raw, responsable, city, plan_tier,
                                is_difficult, difficult_notes, search_preferences, updated_at
                            ) VALUES (
                                :uid, :name, :resp, :city, :plan,
                                :diff, :d_notes, CAST(:pref AS jsonb), NOW()
                            )
                        """),
                        {
                            "uid": new_uid, "name": c_name, "resp": c_resp,
                            "city": c_city, "plan": c_plan, "diff": c_diff,
                            "d_notes": c_diff_notes, "pref": c_pref
                        }
                    )
                    existing_prof_user_ids.add(new_uid)
                    profiles_inserted += 1

            await session.commit()
            print(f"   -> Clientes: {users_updated} actualizados, {users_inserted} nuevos")
            print(f"   -> Perfiles: {profiles_updated} actualizados, {profiles_inserted} nuevos")

            # -------------------------------------------------------------
            # B. MESAS OPERATIVAS DE PSICÓLOGAS (operational_matches)
            # -------------------------------------------------------------
            print("\n[FASE 2/4] Upsert de Mesas Operativas de Psicólogas...")
            om_res = await session.execute(text("""
                SELECT id, LOWER(TRIM(person_a)), LOWER(TRIM(person_b)), psychologist_name 
                FROM operational_matches;
            """))
            om_map = {}
            for r in om_res.fetchall():
                m_id, pa, pb, psyc = r
                om_map[(pa or "", pb or "", (psyc or "").strip().upper())] = m_id

            for m in op_matches:
                pa = m["person_a"].strip()
                pb = m["person_b"].strip()
                psyc = m["psychologist_name"].strip().upper()
                city = m["city"]
                pref = m["pref"] or None
                plan = m["plan_tier"] or None
                st = m["status"]
                obs = m["observations"] or None
                slot = m["slot_number"]
                appr = m["approved_by_maria"]

                uid_a = user_by_norm_name.get(normalize_name(pa))
                uid_b = user_by_norm_name.get(normalize_name(pb)) if pb else None

                key = (normalize_name(pa), normalize_name(pb), psyc)
                existing_mid = om_map.get(key)

                if existing_mid:
                    await session.execute(
                        text("""
                            UPDATE operational_matches
                            SET status = :st,
                                city = COALESCE(NULLIF(:city, ''), city),
                                pref = COALESCE(NULLIF(:pref, ''), pref),
                                plan_tier = COALESCE(NULLIF(:plan, ''), plan_tier),
                                observations = COALESCE(NULLIF(:obs, ''), observations),
                                slot_number = COALESCE(:slot, slot_number),
                                approved_by_maria = :appr,
                                user_id_a = COALESCE(:uid_a, user_id_a),
                                user_id_b = COALESCE(:uid_b, user_id_b),
                                updated_at = NOW()
                            WHERE id = :mid
                        """),
                        {
                            "st": st, "city": city, "pref": pref, "plan": plan,
                            "obs": obs, "slot": slot, "appr": appr,
                            "uid_a": uid_a, "uid_b": uid_b, "mid": existing_mid
                        }
                    )
                    om_updated += 1
                else:
                    ins_om = await session.execute(
                        text("""
                            INSERT INTO operational_matches (
                                person_a, person_b, user_id_a, user_id_b, psychologist_name,
                                city, pref, plan_tier, status, approved_by_maria, observations,
                                slot_number, created_at, updated_at
                            ) VALUES (
                                :pa, :pb, :uid_a, :uid_b, :psyc,
                                :city, :pref, :plan, :st, :appr, :obs,
                                :slot, NOW(), NOW()
                            )
                            RETURNING id;
                        """),
                        {
                            "pa": pa, "pb": pb or None, "uid_a": uid_a, "uid_b": uid_b,
                            "psyc": psyc, "city": city, "pref": pref, "plan": plan,
                            "st": st, "appr": appr, "obs": obs, "slot": slot
                        }
                    )
                    new_mid = ins_om.scalar()
                    om_map[key] = new_mid
                    om_inserted += 1

            await session.commit()
            print(f"   -> operational_matches: {om_updated} actualizados, {om_inserted} nuevos")

            # -------------------------------------------------------------
            # C. MESA CANÓNICA GENERAL DE CITAS (scheduled_dates)
            # -------------------------------------------------------------
            print("\n[FASE 3/4] Upsert de Mesa Canónica de Citas...")
            sched_res = await session.execute(text("SELECT id, LOWER(TRIM(person_a)), LOWER(TRIM(person_b)) FROM scheduled_dates;"))
            sched_map = {}
            for r in sched_res.fetchall():
                s_id, pa, pb = r
                sched_map[(pa or "", pb or "")] = s_id

            for cm in canonical_matches:
                pa = cm["person_a"].strip()
                pb = cm["person_b"].strip()
                dt = cm["date_time"] or None
                venue = cm["venue"] or None
                city = cm["city"] or None
                res_conf = cm["reservation_confirmed"]
                feedback_ella = cm["feedback_ella"] or None
                had_date = bool(cm["match_result"])

                matched_om_id = None
                for (k_pa, k_pb, _), m_id in om_map.items():
                    if k_pa == normalize_name(pa) and k_pb == normalize_name(pb):
                        matched_om_id = m_id
                        break

                key = (normalize_name(pa), normalize_name(pb))
                s_id = sched_map.get(key)

                if s_id:
                    await session.execute(
                        text("""
                            UPDATE scheduled_dates
                            SET date_time = COALESCE(NULLIF(:dt, ''), date_time),
                                venue = COALESCE(NULLIF(:venue, ''), venue),
                                city = COALESCE(NULLIF(:city, ''), city),
                                reservation_confirmed = :res_conf,
                                feedback_ella = COALESCE(NULLIF(:fb, ''), feedback_ella),
                                had_date = :had_date,
                                match_id = COALESCE(:mid, match_id),
                                updated_at = NOW()
                            WHERE id = :sid
                        """),
                        {
                            "dt": dt, "venue": venue, "city": city,
                            "res_conf": res_conf, "fb": feedback_ella,
                            "had_date": had_date, "mid": matched_om_id, "sid": s_id
                        }
                    )
                    sched_updated += 1
                else:
                    ins_s = await session.execute(
                        text("""
                            INSERT INTO scheduled_dates (
                                match_id, person_a, person_b, date_time, venue, city,
                                reservation_confirmed, feedback_ella, had_date, created_at, updated_at
                            ) VALUES (
                                :mid, :pa, :pb, :dt, :venue, :city,
                                :res_conf, :fb, :had_date, NOW(), NOW()
                            )
                            RETURNING id;
                        """),
                        {
                            "mid": matched_om_id, "pa": pa, "pb": pb, "dt": dt,
                            "venue": venue, "city": city, "res_conf": res_conf,
                            "fb": feedback_ella, "had_date": had_date
                        }
                    )
                    new_sid = ins_s.scalar()
                    sched_map[key] = new_sid
                    sched_inserted += 1

            await session.commit()
            print(f"   -> scheduled_dates: {sched_updated} actualizados, {sched_inserted} nuevos")

            # -------------------------------------------------------------
            # D. TABLAS ESPECIALES (TROUBLE MATCHES Y ENAMORADOS)
            # -------------------------------------------------------------
            print("\n[FASE 4/4] Sincronización de Tablas Especiales...")
            if trouble_matches:
                await session.execute(text("TRUNCATE TABLE trouble_matches RESTART IDENTITY;"))
                for tr in trouble_matches:
                    await session.execute(
                        text("""
                            INSERT INTO trouble_matches (person_a, person_b, reported_by, reason, notes, created_at)
                            VALUES (:pa, :pb, 'Google Sheet', :reason, :notes, NOW())
                        """),
                        {
                            "pa": tr["person_a"], "pb": tr["person_b"],
                            "reason": tr["reason"], "notes": tr["notes"]
                        }
                    )
                await session.commit()
                print(f"   -> trouble_matches sincronizados: {len(trouble_matches)}")

            if enamorados:
                for en in enamorados:
                    await session.execute(
                        text("""
                            INSERT INTO historical_matches (
                                person_a, person_b, matchmaker, match_date, status, observations, created_at
                            ) VALUES (
                                :pa, :pb, :mm, :dt, 'ENAMORADOS', :obs, NOW()
                            )
                        """),
                        {
                            "pa": en["person_a"], "pb": en["person_b"],
                            "mm": en["matchmaker"] or "Daily Lover",
                            "dt": en["match_date"] or None,
                            "obs": f"Tiempo enamorados: {en['time_in_love']} | Nota: {en['notes']}"
                        }
                    )
                await session.commit()
                print(f"   -> enamorados registrados en historical_matches: {len(enamorados)}")

            # Conteo final
            count_u_final = (await session.execute(text("SELECT COUNT(*) FROM users;"))).scalar()
            count_p_final = (await session.execute(text("SELECT COUNT(*) FROM profiles;"))).scalar()
            count_om_final = (await session.execute(text("SELECT COUNT(*) FROM operational_matches;"))).scalar()
            count_sd_final = (await session.execute(text("SELECT COUNT(*) FROM scheduled_dates;"))).scalar()

        duration = round(time.time() - start_time, 2)
        print("\n" + "=" * 70)
        print("SINCRONIZACIÓN AUTOMÁTICA FINALIZADA EXITOSAMENTE")
        print(f"Duración: {duration} segundos")
        print(f"Users:               {res_u_before} -> {count_u_final} (+{users_inserted} nuevos, {users_updated} actualizados)")
        print(f"Profiles:            {res_p_before} -> {count_p_final} (+{profiles_inserted} nuevos, {profiles_updated} actualizados)")
        print(f"Operational Matches: {res_om_before} -> {count_om_final} (+{om_inserted} nuevos, {om_updated} actualizados)")
        print(f"Scheduled Dates:     {res_sd_before} -> {count_sd_final} (+{sched_inserted} nuevos, {sched_updated} actualizados)")
        print("=" * 70)

        # 4. Guardar archivo de estado para /api/v1/admin/diagnostics
        backup_size = 0
        if PRE_SYNC_BACKUP_FILE and os.path.isfile(PRE_SYNC_BACKUP_FILE):
            backup_size = os.path.getsize(PRE_SYNC_BACKUP_FILE)

        status_record = {
            "status": "success",
            "last_successful_sync": now_utc,
            "backup_file": PRE_SYNC_BACKUP_FILE,
            "backup_size_bytes": backup_size,
            "records_summary": {
                "users_new": users_inserted,
                "users_updated": users_updated,
                "profiles_new": profiles_inserted,
                "profiles_updated": profiles_updated,
                "operational_matches_new": om_inserted,
                "operational_matches_updated": om_updated,
                "scheduled_dates_new": sched_inserted,
                "scheduled_dates_updated": sched_updated,
                "trouble_matches": len(trouble_matches),
                "enamorados": len(enamorados)
            },
            "table_totals": {
                "users": count_u_final,
                "profiles": count_p_final,
                "operational_matches": count_om_final,
                "scheduled_dates": count_sd_final
            },
            "duration_seconds": duration,
            "last_error": None
        }
        save_status(status_record)
        print(f"\n[OK] Estado de sincronización guardado exitosamente.")

    except Exception as e:
        err_msg = f"Error durante la sincronización con la base de datos: {str(e)}"
        print(f"\n[ERROR EN TRANSACCIÓN] {err_msg}")
        save_status({
            "status": "error",
            "last_successful_sync": None,
            "last_attempt_utc": now_utc,
            "backup_file": PRE_SYNC_BACKUP_FILE,
            "last_error": err_msg
        })
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_sync())
