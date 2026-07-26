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
    
    true_missing_partner = []
    
    for m in matches:
        pb = (m.get('person_b') or '').strip()
        pb_low = pb.lower()
        
        # Truly missing candidate (no person name at all in cell, just notes like "Tiene 3 en espera", "CALI", "SMS", "refund")
        is_pure_note = any(k in pb_low for k in ['tiene 3', 'tiene 2', 'tiene 1', 'en espera', 'sms', 'cali', 'medellin', 'refund', 'sin gente', 'esperar'])
        is_name_like = any(c.isupper() for c in pb) and not pb_low.startswith('tiene') and not pb_low.startswith('waitlist')
        
        if is_pure_note or not is_name_like:
            if not any(w in pb_low for w in ['con', 'andrea', 'juliana', 'kata', 'oscar', 'juan', 'diego']):
                true_missing_partner.append((m.get('id'), m.get('matchmaker'), m.get('person_a'), pb))

print(f"TOTAL MATCHES EN SISTEMA: {len(matches)}")
print(f"REGISTROS DE MATCHES HISTORICOS SIN CANDIDATO EN EL EXCEL: {len(true_missing_partner)}")
print("\nLISTADO COMPLETO DE CASOS SIN PAREJA ASIGNADA (ANOTACIONES DE GESTION):")
for mid, mm, pa, pb in true_missing_partner:
    clean_pb = pb.encode('ascii', 'ignore').decode('ascii')
    clean_pa = pa.encode('ascii', 'ignore').decode('ascii')
    print(f" • ID #{mid:<4d} | {mm:<14s} | Cliente: {clean_pa:<32s} | Celda Excel: '{clean_pb}'")
