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

for m_key in ['SILVI', 'MANU', 'ALEJA', 'JENN', 'SOFI', 'STEFFY', 'ANA', 'LAU', 'MAPE D']:
    req_pend = urllib.request.Request(f'https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?matchmaker={m_key}&status_filter=PENDIENTE&limit=1', headers={'Authorization': f'Bearer {token}'})
    req_trbl = urllib.request.Request(f'https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?matchmaker={m_key}&status_filter=TROUBLE&limit=1', headers={'Authorization': f'Bearer {token}'})
    req_u = urllib.request.Request(f'https://prueba-daily.agentesia.cloud/api/v1/admin/users?responsable={m_key}&limit=1', headers={'Authorization': f'Bearer {token}'})
    
    with urllib.request.urlopen(req_pend, context=ctx) as r1:
        p_total = json.loads(r1.read().decode()).get('total', 0)
    with urllib.request.urlopen(req_trbl, context=ctx) as r2:
        t_total = json.loads(r2.read().decode()).get('total', 0)
    with urllib.request.urlopen(req_u, context=ctx) as r3:
        u_total = json.loads(r3.read().decode()).get('total', 0)
        
    print(f"PSICÓLOGA {m_key:<8s} -> Pendientes: {p_total:<3d} | Trouble: {t_total:<3d} | Clientes Asignados: {u_total:<3d}")
