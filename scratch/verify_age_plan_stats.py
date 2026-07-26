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
    clients = d.get('assigned_clients', [])
    with_age = sum(1 for c in clients if c.get('age') is not None)
    with_plan = sum(1 for c in clients if c.get('plan_tier') and c.get('plan_tier') != 'Sin Plan')
    print(f"SILVI CLIENTS TOTAL: {len(clients)}")
    print(f"WITH AGE POPULATED: {with_age}/{len(clients)}")
    print(f"WITH PLAN POPULATED: {with_plan}/{len(clients)}")
