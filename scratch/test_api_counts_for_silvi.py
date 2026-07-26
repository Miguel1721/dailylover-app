import urllib.request
import json
import ssl
import urllib.parse

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

data = json.dumps({'email': 'mariapaula@dailylover.com', 'password': 'Daily2026!'}).encode('utf-8')
req = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/auth/login', data=data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, context=ctx) as response:
    token = json.loads(response.read().decode()).get('access_token')

for m_key in ['SILVI', 'MATCHES SILVI']:
    enc_key = urllib.parse.quote(m_key)
    for sf in ['all', 'PENDIENTE', 'TROUBLE']:
        req_m = urllib.request.Request(f'https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?matchmaker={enc_key}&status_filter={sf}&limit=100', headers={'Authorization': f'Bearer {token}'})
        with urllib.request.urlopen(req_m, context=ctx) as r:
            res = json.loads(r.read().decode())
            print(f"=== MATCHMAKER: '{m_key}' | FILTER: '{sf}' ===")
            print(f"  Total returned: {res.get('total')}")
            matches = res.get('matches', [])
            print(f"  Matches in list: {len(matches)}")
            if matches:
                print(f"  First 3 IDs: {[x.get('id') for x in matches[:3]]}")
                print(f"  First 3 Statuses: {[x.get('status') for x in matches[:3]]}")
