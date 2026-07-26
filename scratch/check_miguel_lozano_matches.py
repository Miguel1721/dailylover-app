import urllib.request
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

print("--- REVISANDO USUARIO MIGUEL LOZANO ---")
url_u = f'{API}/api/v1/admin/users?search=miguel+lozano'
req_u = urllib.request.Request(url_u, headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_u) as r:
    data_u = json.loads(r.read().decode())
    print("Usuarios encontrados:", len(data_u.get('users', [])))
    for u in data_u.get('users', []):
        print(f" ID: {u.get('id')} | Nombre: {u.get('name')} | Tel: {u.get('phone')} | Psicóloga Responsable: {u.get('responsable')}")

print("\n--- REVISANDO MATCHES DE MIGUEL LOZANO (TODAS LAS PSICÓLOGAS) ---")
url_m = f'{API}/api/v1/admin/historical-matches?search=miguel+lozano&matchmaker=all'
req_m = urllib.request.Request(url_m, headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_m) as r:
    data_m = json.loads(r.read().decode())
    print("Matches encontrados bajo 'matchmaker=all':", data_m.get('total'))
    for m in data_m.get('matches', []):
        print(f" Match ID #{m.get('id')}: {m.get('person_a')}  ❤️  {m.get('person_b')} | Psicóloga: '{m.get('matchmaker')}' | Estado: {m.get('status')}")
