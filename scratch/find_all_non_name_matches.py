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

req_m = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?limit=1000', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_m, context=ctx) as r:
    matches = json.loads(r.read().decode()).get('matches', [])
    print("MATCHES DONDE PERSON_B ES UNA NOTA O TEXTO SIN NOMBRE:")
    for m in matches:
        pa = m.get('person_a', '').strip()
        pb = m.get('person_b', '').strip()
        
        # Check if pb is not a name
        pb_low = pb.lower()
        if any(k in pb_low for k in ['waitlist', 'espera', 'cali', 'medellin', 'sms', 'ya tiene', 'le falta', 'no hay gente']):
            print(f"ID #{m.get('id')} | Matchmaker: {m.get('matchmaker')} | A: '{pa}' | B (Texto Excel): '{pb}'")
