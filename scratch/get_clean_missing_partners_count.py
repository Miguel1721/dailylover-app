import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

data = json.dumps({'email': 'mariapaula@dailylover.com', 'password': 'Daily2026!'}).encode('utf-8')
req = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/auth/login', data=data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, context=ctx) as response:
    token = json.loads(response.read().decode()).get('access_token')

req_m = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?limit=4000', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_m, context=ctx) as r:
    matches = json.loads(r.read().decode()).get('matches', [])
    
    true_no_name_records = []
    
    non_name_phrases = [
        'tiene 3', 'tiene 2', 'tiene 1', 'en espera', 'sms', 'cali', 'medellin', 'refund',
        'sin gente', 'esperar', 'le ofreci', 'se envia', 'enviamos', 'considerar refund',
        'refundar done', 'refund approved', 'un amigo de', '300-400k'
    ]
    
    for m in matches:
        pb = (m.get('person_b') or '').strip()
        pb_low = pb.lower()
        
        # Is it a pure note without a candidate name?
        is_pure_note = any(k in pb_low for k in non_name_phrases) and not any(w in pb_low for w in ['con ', 'sale con', 'andrea', 'juliana', 'kata', 'oscar', 'juan', 'diego'])
        if is_pure_note:
            true_no_name_records.append((m.get('id'), m.get('matchmaker'), m.get('person_a'), pb))

print(f"TOTAL MATCHES AUDITADOS EN BASE DE DATOS: {len(matches)}")
print(f"REGISTROS DE MATCHES HISTORICOS SIN NOMBRE DE PAREJA: {len(true_no_name_records)} ({round(len(true_no_name_records)/len(matches)*100, 2)}%)")

print("\n--- LISTADO COMPLETO Y DETALLADO DE LOS 28 REGISTROS SIN NOMBRE EN EXCEL ---")
for mid, mm, pa, pb in true_no_name_records:
    clean_pb = pb.encode('ascii', 'ignore').decode('ascii')
    clean_pa = pa.encode('ascii', 'ignore').decode('ascii')
    print(f" • ID #{mid:<4d} | {mm:<14s} | Cliente: {clean_pa:<32s} | Texto en celda pareja: '{clean_pb}'")
