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

req_ag = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/psychologist/agenda?psychologist_name=SILVI', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_ag, context=ctx) as r:
    d = json.loads(r.read().decode())
    print(f"SILVI ASSIGNED CLIENTS: {len(d.get('assigned_clients', []))}")
    for c in d.get('assigned_clients', [])[:10]:
        print(f"• {c.get('name')} | Age: {c.get('age')} | City: {c.get('city')} | Plan: {c.get('plan_tier')}")
