import urllib.request
import urllib.parse
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

API = 'https://prueba-daily.agentesia.cloud'
login_url = f'{API}/api/v1/auth/login'

req_l = urllib.request.Request(
    login_url,
    data=json.dumps({'email': 'mariapaula@dailylover.com', 'password': 'Daily2026!'}).encode(),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req_l) as r:
    token = json.loads(r.read().decode())['access_token']

print("--- BUSCANDO EN HISTORICAL MATCHES ---")
for term in ['garcia', 'garcía', 'diego', 'diego garcia', 'genesis']:
    url = f'{API}/api/v1/admin/historical-matches?search={urllib.parse.quote(term)}&limit=10'
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read().decode())
        print(f"\nTérmino '{term}': Total {data.get('total')} matches encontrados")
        for m in data.get('matches', [])[:5]:
            print(f"  [ID {m.get('id')}] {m.get('person_a')}  ❤️  {m.get('person_b')} (Psicóloga: {m.get('matchmaker')})")

print("\n--- BUSCANDO EN USERS / CLIENTES ---")
for term in ['garcia', 'garcía', 'diego', 'gallego']:
    url = f'{API}/api/v1/admin/users?search={urllib.parse.quote(term)}&limit=10'
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read().decode())
        print(f"\nTérmino '{term}': Total {data.get('total')} clientes encontrados")
        for u in data.get('users', [])[:5]:
            print(f"  [ID {u.get('id')}] {u.get('name')} - {u.get('phone')} (Psicóloga: {u.get('responsable')})")
