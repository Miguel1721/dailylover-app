import urllib.request
import json

data = json.dumps({'email': 'mariapaula@dailylover.com', 'password': 'Daily2026!'}).encode('utf-8')
req = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/auth/login', data=data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as response:
    token = json.loads(response.read().decode()).get('access_token')

test_combos = [
    ('Bogotá sola', 'city=Bogot%C3%A1'),
    ('Medellín sola', 'city=Medell%C3%ADn'),
    ('VIP 195k + Bogotá', 'plan_tier=195&city=Bogot%C3%A1'),
    ('Premium 150k + Bogotá', 'plan_tier=150&city=Bogot%C3%A1'),
    ('Estándar 65k + Bogotá', 'plan_tier=65&city=Bogot%C3%A1'),
    ('Estándar 65k + Medellín', 'plan_tier=65&city=Medell%C3%ADn'),
    ('Mape + Bogotá', 'responsable=Mape&city=Bogot%C3%A1'),
    ('Mape + Premium 150k', 'responsable=Mape&plan_tier=150'),
    ('Mape + Premium 150k + Bogotá', 'responsable=Mape&plan_tier=150&city=Bogot%C3%A1'),
    ('Con Bio Clínica + Bogotá', 'has_notes=with_notes&city=Bogot%C3%A1'),
]

print('=== RESULTADOS DE PRUEBAS DE FILTROS COMBINADOS (PRODUCCIÓN) ===')
for label, query in test_combos:
    req_test = urllib.request.Request(f'https://prueba-daily.agentesia.cloud/api/v1/admin/users?limit=5&{query}', headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req_test) as r:
        cnt = json.loads(r.read().decode()).get('total')
        print(f'• {label}: {cnt} clientes encontrados')
