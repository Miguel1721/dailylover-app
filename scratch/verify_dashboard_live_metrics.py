import urllib.request
import json
import ssl
from PIL import Image
import io

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

data = json.dumps({'email': 'mariapaula@dailylover.com', 'password': 'Daily2026!'}).encode('utf-8')
req = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/auth/login', data=data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, context=ctx) as response:
    token = json.loads(response.read().decode()).get('access_token')

print("=== VERIFICACIÓN VISUAL EN VIVO DE METRICAS DEL DASHBOARD ===")
for p_name in ['SILVI', 'LAU', 'JENN']:
    r1 = urllib.request.Request(f'https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?matchmaker={p_name}&status_filter=PENDIENTE&limit=1', headers={'Authorization': f'Bearer {token}'})
    r2 = urllib.request.Request(f'https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?matchmaker={p_name}&status_filter=TROUBLE&limit=1', headers={'Authorization': f'Bearer {token}'})
    r3 = urllib.request.Request(f'https://prueba-daily.agentesia.cloud/api/v1/admin/users?responsable={p_name}&limit=1', headers={'Authorization': f'Bearer {token}'})
    
    pend_total = json.loads(urllib.request.urlopen(r1, context=ctx).read().decode()).get('total', 0)
    trbl_total = json.loads(urllib.request.urlopen(r2, context=ctx).read().decode()).get('total', 0)
    user_total = json.loads(urllib.request.urlopen(r3, context=ctx).read().decode()).get('total', 0)
    
    print(f"PSICOLOGA {p_name}:")
    print(f"   • Card Pendientes (KPI 1): {pend_total} matches esperando visto bueno")
    print(f"   • Card Clientes   (KPI 2): {user_total} clientes asignados a su cargo")
    print(f"   • Card Trouble    (KPI 4): {trbl_total} casos especiales / trouble")

