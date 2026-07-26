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

print("=== PROBANDO FILTROS DE HISTORICAL MATCHES ===")

for mm in ['all', 'SILVI', 'MANU', 'STEFFY', 'ANA', 'LAU']:
    for st in ['all', 'PENDIENTE', 'APROBADO', 'RECHAZADO', 'TROUBLE']:
        url = f"https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?matchmaker={mm}&status_filter={st}&limit=5"
        req_f = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
        with urllib.request.urlopen(req_f, context=ctx) as r:
            res = json.loads(r.read().decode())
            total = res.get("total", 0)
            print(f"Matchmaker: {mm:<8s} | Status: {st:<10s} -> Total: {total}")
