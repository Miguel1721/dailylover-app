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

req_diff = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/users?limit=10&is_difficult=difficult_only', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_diff, context=ctx) as r:
    d = json.loads(r.read().decode())
    print(f"PROD PERSONAS DIFICILES FILTER: {d.get('total')} clientes etiquetados!")
    for u in d.get('users', []):
        print(f"• ID #{u.get('id')} | {u.get('name')} | Notes: {u.get('difficult_notes')}")
