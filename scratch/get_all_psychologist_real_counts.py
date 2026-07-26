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

for m_key in ['SILVI', 'MANU', 'ALEJA', 'JENN', 'SOFI', 'STEFFY', 'ANA', 'LAU']:
    r1 = urllib.request.Request(f'https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?matchmaker={m_key}&status_filter=PENDIENTE&limit=1', headers={'Authorization': f'Bearer {token}'})
    r2 = urllib.request.Request(f'https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?matchmaker={m_key}&status_filter=TROUBLE&limit=1', headers={'Authorization': f'Bearer {token}'})
    r3 = urllib.request.Request(f'https://prueba-daily.agentesia.cloud/api/v1/admin/users?responsable={m_key}&limit=1', headers={'Authorization': f'Bearer {token}'})
    
    p_t = json.loads(urllib.request.urlopen(r1, context=ctx).read().decode()).get('total', 0)
    t_t = json.loads(urllib.request.urlopen(r2, context=ctx).read().decode()).get('total', 0)
    u_t = json.loads(urllib.request.urlopen(r3, context=ctx).read().decode()).get('total', 0)
    
    print(f"PSICÓLOGA: {m_key:<8s} | Pendientes Reales: {p_t:<4d} | Trouble Reales: {t_t:<4d} | Clientes: {u_t:<4d}")
