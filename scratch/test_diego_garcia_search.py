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

print("--------------------------------------------------")
print(" VERIFICANDO BÚSQUEDA DE DIEGO GARCÍA Y DIEGO GALLEGO")
print("--------------------------------------------------")

url = f'{API}/api/v1/admin/users?search=diego+ga'
req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req) as r:
    d = json.loads(r.read().decode())
    print(f"Búsqueda 'diego ga' -> Total encontrados: {d.get('total')}\n")
    for u in d.get('users', []):
        print(f" 👤 ID #{u.get('id')}: {u.get('name')} | Teléfono: {u.get('phone')} | Psicóloga: {u.get('responsable')}")

print("\n--------------------------------------------------")
