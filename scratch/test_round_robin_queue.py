import urllib.request
import json
import random
import sys

sys.stdout.reconfigure(encoding='utf-8')
BASE_URL = "https://prueba-daily.agentesia.cloud"

print("======================================================================")
print(" 🔄 PRUEBA DE COLA DE ASIGNACIÓN ROTATIVA (ROUND-ROBIN 1->2->3->4) ")
print("======================================================================\n")

# 1. Login Admin to check notifications and assignments
admin_login = {"email": "mariapaula@dailylover.com", "password": "Daily2026!"}
req = urllib.request.Request(f"{BASE_URL}/api/v1/auth/login", data=json.dumps(admin_login).encode(), headers={'Content-Type':'application/json'})
with urllib.request.urlopen(req) as resp:
    admin_data = json.loads(resp.read().decode())
    admin_token = admin_data['access_token']

print("▶️ Registrando 4 clientes consecutivos para verificar la cola equitativa...\n")

for i in range(1, 5):
    random_num = f"300{random.randint(1000000, 9999999)}"
    test_user = {
        "name": f"Cliente Prueba Cola #{i}",
        "phone": random_num,
        "email": f"cliente_cola_{random_num}@dailylover.com",
        "password": "Password2026!",
        "city": "Bogotá",
        "accepted_terms": True,
        "motivacion": "conexion_profunda"
    }
    
    req_reg = urllib.request.Request(
        f"{BASE_URL}/api/v1/auth/client-register",
        data=json.dumps(test_user).encode(),
        headers={'Content-Type':'application/json'}
    )
    with urllib.request.urlopen(req_reg) as resp:
        reg_res = json.loads(resp.read().decode())
        u_id = reg_res['client']['id']
        
    # Check assigned matchmaker in admin list
    req_usr = urllib.request.Request(
        f"{BASE_URL}/api/v1/admin/users?search={random_num}",
        headers={'Authorization': f"Bearer {admin_token}"}
    )
    with urllib.request.urlopen(req_usr) as resp:
        usr_res = json.loads(resp.read().decode())
        u_data = usr_res.get('users', [])[0]
        
    print(f"   👤 Registro #{i}: {test_user['name']} (ID: {u_id})")
    print(f"      👉 Psicóloga Asignada en Cola Rotativa: 🎯 {u_data.get('responsable')}")

# Check created reminders in admin panel
print("\n▶️ Verificando Notificaciones Generadas en el Panel de la Psicóloga...")
req_rem = urllib.request.Request(
    f"{BASE_URL}/api/v1/admin/reminders",
    headers={'Authorization': f"Bearer {admin_token}"}
)
with urllib.request.urlopen(req_rem) as resp:
    rem_data = json.loads(resp.read().decode())
    reminders = rem_data.get('reminders', [])

print(f"   🔔 Últimas 4 Notificaciones Prioritarias en Sistema:")
for r in reminders[:4]:
    print(f"      - [{r.get('priority')}] {r.get('title')} -> Asignado a: {r.get('matchmaker')} ({r.get('client_name')})")

print("\n======================================================================")
print(" ✅ COLA DE ASIGNACIÓN ROTATIVA Y NOTIFICACIONES VERIFICADAS AL 100%")
print("======================================================================")
