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
    
    truly_without_partner_name = []
    
    note_indicators = [
        'tiene 3', 'tiene 2', 'tiene 1', 'en espera', 'sms', 'cali', 'medellin', 'refund',
        'sin gente', 'esperar', 'revisar', 'trouble', 'no contesto', 'descalificado',
        'cancelado', 'esperando', 'hacer otro', 'ya salio', 'creo que'
    ]
    
    for m in matches:
        pb = (m.get('person_b') or '').strip()
        pb_low = pb.lower()
        
        # Check if pb is purely a note or status text and does NOT contain any real person name
        is_note = any(k in pb_low for k in note_indicators) or len(pb) > 30
        has_name_keyword = any(k in pb_low for k in ['con ', 'sale con', 'mateus', 'buluy', 'sayago', 'moreno', 'ruiz', 'rojas', 'gallego', 'garcia', 'almanza', 'gomez'])
        
        if is_note and not has_name_keyword:
            truly_without_partner_name.append((m.get('id'), m.get('matchmaker'), m.get('person_a'), pb))

print(f"TOTAL MATCHES AUDITADOS: {len(matches)}")
print(f"REGISTROS TOTALES SIN NOMBRE DE PAREJA: {len(truly_without_partner_name)} ({round(len(truly_without_partner_name)/len(matches)*100, 2)}%)")

print("\n--- DESGLOSE COMPLETO DE LOS CASOS SIN NOMBRE EN EXCEL ---")
for mid, mm, pa, pb in truly_without_partner_name:
    clean_pb = pb.encode('ascii', 'ignore').decode('ascii')
    clean_pa = pa.encode('ascii', 'ignore').decode('ascii')
    print(f" ID #{mid:<4d} | {mm:<14s} | Cliente: {clean_pa:<32s} | Anotacion Excel: '{clean_pb}'")
