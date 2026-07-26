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
    
    no_partner_assigned = []
    embedded_partner_found = []
    clean_matches = []
    
    note_keywords = ['waitlist', 'espera', 'confirme', 'vuelva', 'creo', 'sacó', 'salió', 'double date', 'rarito', 'canceló', 'descalificado', 'enfermo', 'vuelve', 'escribirle', 'no volvió', 'le falta', 'ya tiene', 'pago', 'refund', 'trouble', 'sms', 'cali', 'medellin', 'no hay gente']
    
    for m in matches:
        pa = (m.get('person_a') or '').strip()
        pb = (m.get('person_b') or '').strip()
        pb_low = pb.lower()
        
        has_note_in_b = any(k in pb_low for k in note_keywords) or len(pb) > 28
        
        if has_note_in_b:
            if any(k in pb_low for k in ['con ', 'sale con']):
                embedded_partner_found.append((m.get('id'), m.get('matchmaker'), pa, pb))
            else:
                no_partner_assigned.append((m.get('id'), m.get('matchmaker'), pa, pb))
        else:
            clean_matches.append(m)

print(f"=== BALANCE DE AUDITORIA DE MATCHES (TOTAL: {len(matches)}) ===")
print(f"MATCHES CON PAREJAS REALES IDENTIFICADAS: {len(clean_matches) + len(embedded_partner_found)} ({round((len(clean_matches) + len(embedded_partner_found))/len(matches)*100, 1)}%)")
print(f"   • Nombres limpios directos: {len(clean_matches)}")
print(f"   • Nombres extraidos automaticamente de notas: {len(embedded_partner_found)}")
print(f"\nREGISTROS SIN PAREJA ASIGNADA EN EXCEL: {len(no_partner_assigned)} ({round(len(no_partner_assigned)/len(matches)*100, 1)}%)")

print("\n--- DETALLE DE LOS REGISTROS SIN PAREJA ASIGNADA EN EXCEL ---")
for mid, mm, pa, pb in no_partner_assigned:
    clean_pb = pb.encode('ascii', 'ignore').decode('ascii')
    print(f"  • ID #{mid:<4d} | {mm:<14s} | Cliente: {pa:<32s} | Texto en celda pareja: '{clean_pb}'")

