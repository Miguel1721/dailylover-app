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
    statuses = {}
    for m in matches:
        st = (m.get('status') or 'NULL').strip()
        statuses[st] = statuses.get(st, 0) + 1
    
    print("=== TODOS LOS ESTADOS UNICOS EN HISTORICAL MATCHES ===")
    for st, count in sorted(statuses.items(), key=lambda x: x[1], reverse=True)[:35]:
        print(f"• Status: '{st}' -> {count} matches")
