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
    print("=== SILVI CLIENTS CHECK FOR DANIELA, ALEXIS, CAMILO, DIEGO, EDUARDO ===")
    targets = ['daniela ballesteros', 'alexis palacio', 'camilo humberto prieto', 'diego alejandro neira', 'eduardo espinosa']
    for c in clients:
        if any(t in c.get('name', '').lower() for t in targets):
            print(f"• {c.get('name')} | Inscripcion: {c.get('created_at')} | City: {c.get('city')}")
