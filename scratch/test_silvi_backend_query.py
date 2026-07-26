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

for m_key in ['SILVI', 'MATCHES SILVI', 'SILVIA']:
    req_m = urllib.request.Request(f'https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?matchmaker={m_key}&limit=100', headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req_m, context=ctx) as r:
        res = json.loads(r.read().decode())
        print(f"=== MATCHMAKER QUERY: '{m_key}' ===")
        print(f"Total matches: {res.get('total')}")
        matches = res.get('matches', [])
        pendings = [m for m in matches if 'PENDIENTE' in (m.get('status') or '').upper() or 'HECHO' not in (m.get('status') or '').upper()]
        troubles = [m for m in matches if any(k in (m.get('status') or '').upper() for k in ['TROUBLE', 'REVISAR', 'NO HAY', 'ESPERA', 'WAITLIST'])]
        print(f"Pendings count in sample: {len(pendings)}")
        print(f"Troubles count in sample: {len(troubles)}")
        for p in pendings[:5]:
            print(f"   ID #{p.get('id')} | A: {p.get('person_a')} | B: {p.get('person_b')} | ST: {p.get('status')}")
