import sys
import os
import json
import re
import subprocess
from google.oauth2 import service_account
from googleapiclient.discovery import build

sys.stdout.reconfigure(encoding='utf-8')

CREDS_FILE = r"C:\Users\jeloz\Documents\antigravity\zealous-fermi\scratch\service_account.json"
SHEET_ID = "1ziZsPwYv6I3fEIEyVM7I0Na7LLgzrwyfM8vcglUQ8RA"

key_jump = r"C:\Users\jeloz\.ssh\llave_server_149"
key_dl   = r"C:\Users\jeloz\.ssh\vps_dailylover"
jump     = "ubuntu@157.137.232.7"

def fetch_sheet_data():
    creds = service_account.Credentials.from_service_account_file(
        CREDS_FILE,
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    service = build("sheets", "v4", credentials=creds)

    res = service.spreadsheets().values().get(
        spreadsheetId=SHEET_ID,
        range="'PERSONAS DÍFICILES'!A1:ZZ100"
    ).execute()

    rows = res.get("values", [])
    print(f"Total filas recibidas de 'PERSONAS DÍFICILES': {len(rows)}")
    
    records = []
    if len(rows) > 1:
        headers = [str(h).strip().upper() for h in rows[0]]
        print(f"Headers: {headers}")

        for r in rows[1:]:
            if not r or not any(r):
                continue
            person_a = r[0].strip() if len(r) > 0 and r[0] else ""
            if not person_a:
                continue
                
            interviewed_by = r[1].strip() if len(r) > 1 and r[1] else ""
            plan = r[2].strip() if len(r) > 2 and r[2] else ""
            city = r[3].strip() if len(r) > 3 and r[3] else ""
            pref = r[4].strip() if len(r) > 4 and r[4] else ""
            fecha_ingreso = r[5].strip() if len(r) > 5 and r[5] else ""
            obs = r[6].strip() if len(r) > 6 and r[6] else ""
            status = r[7].strip() if len(r) > 7 and r[7] else "DIFICIL"
            slots = r[8].strip() if len(r) > 8 and r[8] else ""
            
            # Detectar ciudad en observaciones si no viene en columna de ciudad
            if not city and obs:
                obs_lower = obs.lower()
                if "cali" in obs_lower:
                    city = "Cali"
                elif "med" in obs_lower:
                    city = "Medellín"
                elif "bucaramanga" in obs_lower:
                    city = "Bucaramanga"
                elif "cartagena" in obs_lower:
                    city = "Cartagena"
                elif "chía" in obs_lower or "chia" in obs_lower:
                    city = "Chía"
                elif "cucuta" in obs_lower or "cúcuta" in obs_lower:
                    city = "Cúcuta"
                elif "villavicencio" in obs_lower:
                    city = "Villavicencio"
                elif "bquilla" in obs_lower or "barranquilla" in obs_lower:
                    city = "Barranquilla"
                elif "bog" in obs_lower:
                    city = "Bogotá"

            # Si el status viene en otra columna por formato legacy
            if not status or status == "":
                status = "DIFICIL"

            records.append({
                "client_name": person_a,
                "interviewed_by": interviewed_by,
                "city": city or "Bogotá",
                "plan": plan,
                "reason": pref or "Criterios complejos / Restricciones clínicas",
                "status": status,
                "notes": obs,
                "category": "Restricción Clínica" if "años" in obs.lower() or "sg" in obs.lower() else "Falta de Candidatos" if "nadie" in obs.lower() or "gente" in obs.lower() else "Caso Especial"
            })
            
    print(f"Total registros estructurados: {len(records)}")
    return records

def push_to_db(records):
    # Generar SQL para agregar columnas si no existen y poblar datos
    sql_statements = [
        "ALTER TABLE difficult_clients ADD COLUMN IF NOT EXISTS city VARCHAR(100);",
        "ALTER TABLE difficult_clients ADD COLUMN IF NOT EXISTS plan VARCHAR(100);",
        "TRUNCATE TABLE difficult_clients RESTART IDENTITY;"
    ]

    for rec in records:
        name_esc = rec['client_name'].replace("'", "''")
        psyc_esc = rec['interviewed_by'].replace("'", "''")
        city_esc = rec['city'].replace("'", "''")
        plan_esc = rec['plan'].replace("'", "''")
        reason_esc = rec['reason'].replace("'", "''")
        status_esc = rec['status'].replace("'", "''")
        notes_esc = rec['notes'].replace("'", "''")
        cat_esc = rec['category'].replace("'", "''")

        sql_statements.append(f"""
            INSERT INTO difficult_clients (client_name, interviewed_by, city, plan, reason, status, notes, category, created_at)
            VALUES ('{name_esc}', '{psyc_esc}', '{city_esc}', '{plan_esc}', '{reason_esc}', '{status_esc}', '{notes_esc}', '{cat_esc}', NOW());
        """)

    full_sql = "\n".join(sql_statements)
    
    # Escribir a archivo temporal en scratch y enviar a VPS
    local_sql_path = r"C:\Users\jeloz\Documents\antigravity\zealous-fermi\scratch\import_difficult_clients.sql"
    with open(local_sql_path, "w", encoding="utf-8") as f:
        f.write(full_sql)

    print(f"Archivo SQL temporal creado con {len(sql_statements)} sentencias.")

    # Copiar y ejecutar en VPS
    scp_cmd = ['scp', '-i', key_jump, '-o', 'StrictHostKeyChecking=no', key_dl, f'{jump}:/tmp/dl_key']
    subprocess.run(scp_cmd, capture_output=True)

    scp_sql = ['scp', '-i', key_jump, '-o', 'StrictHostKeyChecking=no', local_sql_path, f'{jump}:/tmp/import_difficult_clients.sql']
    subprocess.run(scp_sql, capture_output=True)

    remote_exec = '''
    chmod 600 /tmp/dl_key 2>/dev/null
    scp -i /tmp/dl_key -o StrictHostKeyChecking=no /tmp/import_difficult_clients.sql ubuntu@149.130.162.11:/tmp/import_difficult_clients.sql
    ssh -i /tmp/dl_key -o StrictHostKeyChecking=no ubuntu@149.130.162.11 "docker exec -i dl_postgres psql -U postgres -d dailylover < /tmp/import_difficult_clients.sql"
    ssh -i /tmp/dl_key -o StrictHostKeyChecking=no ubuntu@149.130.162.11 "docker exec dl_postgres psql -U postgres -d dailylover -c 'SELECT COUNT(*) FROM difficult_clients;'"
    '''

    proc = subprocess.Popen(
        ['ssh', '-i', key_jump, '-o', 'StrictHostKeyChecking=no', jump, 'bash -s'],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    out, err = proc.communicate(input=remote_exec.encode(), timeout=30)
    print("STDOUT:\n", out.decode(errors='replace'))
    print("STDERR:\n", err.decode(errors='replace'))

if __name__ == "__main__":
    records = fetch_sheet_data()
    push_to_db(records)
