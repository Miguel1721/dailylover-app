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

req_m = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?limit=300', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_m, context=ctx) as r:
    matches = json.loads(r.read().decode()).get('matches', [])
    print("MATCHES CON TEXTO CLINICO EN LUGAR DE NOMBRE:")
    for m in matches:
        pa = m.get('person_a', '')
        pb = m.get('person_b', '')
        pa_low = pa.lower()
        pb_low = pb.lower()
        keywords = ['waitlist', 'creo', 'sacó', 'salió', 'rarito', 'espera', 'canceló', 'descalificado', 'pago', 'date', 'vuelve', 'tien']
        if any(k in pa_low or k in pb_low for k in keywords):
            print(f"ID #{m.get('id')} | A: '{pa}' | B: '{pb}' | Obs: '{m.get('observations')}'")
