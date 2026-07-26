import urllib.request
import json
import time

time.sleep(20)

data = json.dumps({'email': 'mariapaula@dailylover.com', 'password': 'Daily2026!'}).encode('utf-8')
req = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/auth/login', data=data, headers={'Content-Type': 'application/json'})

with urllib.request.urlopen(req) as response:
    token = json.loads(response.read().decode()).get('access_token')

for plan_code in ['195', '150', '98', '65', '40']:
    req_plan = urllib.request.Request(f'https://prueba-daily.agentesia.cloud/api/v1/admin/users?limit=5&plan_tier={plan_code}', headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req_plan) as resp_plan:
        d = json.loads(resp_plan.read().decode())
        print(f"PROD FILTER PLAN {plan_code}: {d.get('total')} clientes encontrados!")
