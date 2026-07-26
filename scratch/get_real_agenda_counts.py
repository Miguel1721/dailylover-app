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

for p_name in ['SILVI', 'LAU', 'JENN', 'MANU', 'ALEJA', 'SOFI', 'STEFFY', 'ANA']:
    req_a = urllib.request.Request(f'https://prueba-daily.agentesia.cloud/api/v1/admin/psychologist/agenda?psychologist_name={p_name}', headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req_a, context=ctx) as r:
        d = json.loads(r.read().decode())
        invs = d.get('total_interviews', 0)
        cls = d.get('total_assigned_clients', 0)
        print(f"PSICOLOGA {p_name:<8s} -> Entrevistas Agendadas: {invs} | Clientes: {cls}")
