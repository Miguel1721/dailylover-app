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

req_f = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?matchmaker=SILVI&limit=50', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_f, context=ctx) as r:
    res = json.loads(r.read().decode())
    print("MATCHES DE SILVI EN BASE DE DATOS:")
    for m in res.get('matches', []):
        print(f"ID #{m.get('id')} | A: '{m.get('person_a')}' <-> B: '{m.get('person_b')}' | Status: '{m.get('status')}'")
