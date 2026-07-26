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

req_u = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/users/7792', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_u, context=ctx) as r:
    d = json.loads(r.read().decode())
    print("USER 7792 MATCHES:")
    for m in d.get('historical_matches', []):
        print(f"• ID #{m.get('id')} | {m.get('person_a')} <-> {m.get('person_b')} | Date: {m.get('date')} | Status: {m.get('status')}")
