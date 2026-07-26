import urllib.request
import json

data = json.dumps({'email': 'mariapaula@dailylover.com', 'password': 'Daily2026!'}).encode('utf-8')
req = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/auth/login', data=data, headers={'Content-Type': 'application/json'})

with urllib.request.urlopen(req) as response:
    token = json.loads(response.read().decode()).get('access_token')

req_vip = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/users?limit=50&plan_tier=195', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_vip) as resp_vip:
    d = json.loads(resp_vip.read().decode())
    print('TOTAL VIP USERS FOUND:', d.get('total'))
    for u in d.get('users', []):
        prof = u.get('profile', {})
        print(f"ID #{u.get('id')} | Name: {u.get('name')} | City: '{u.get('city')}' | Prof City: '{prof.get('city')}' | Resp: '{u.get('responsable')}'")
