import time
import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

time.sleep(4)

data = json.dumps({'email': 'mariapaula@dailylover.com', 'password': 'Daily2026!'}).encode('utf-8')
req = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/auth/login', data=data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, context=ctx) as response:
    token = json.loads(response.read().decode()).get('access_token')

print("=== 1. CREANDO UN RECORDATORIO DE PRUEBA REAL EN VIVO ===")
payload = {
    'title': 'Llamada de Seguimiento Cita de Café',
    'client_name': 'Camila Restrepo',
    'client_phone': '+573001234567',
    'priority': 'URGENTE',
    'due_date': 'Hoy 6:00 PM',
    'notes': 'Verificar impresion sobre el restaurante Sorella',
    'matchmaker': 'SILVI'
}
req_create = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/reminders', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_create, context=ctx) as r:
    print('  Respuesta servidor:', r.read().decode())

print("\n=== 2. CONSULTANDO LO QUE RETORNA LA API PARA LA VISTA WEB ===")
req_get = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/reminders?matchmaker=SILVI', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_get, context=ctx) as r:
    rems = json.loads(r.read().decode()).get('reminders', [])
    actives = [x for x in rems if not x['completed']]
    print(f"  Total Recordatorios en BD: {len(rems)} | Activos Pendientes: {len(actives)}")
    for a in actives:
        print(f"   • ID #{a['id']} | Prioridad: {a['priority']} | Titulo: '{a['title']}' | Cliente: {a['client_name']}")
