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

req_g = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/reminders?matchmaker=SILVI', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_g, context=ctx) as r:
    rems = json.loads(r.read().decode()).get('reminders', [])
    print("SILVI REMINDERS:")
    for rem in rems:
        print(f"  ID #{rem['id']} | Title: '{rem['title']}' | Completed: {rem['completed']}")
