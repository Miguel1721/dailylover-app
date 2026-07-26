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

# Truncate reminders table in production so it starts 100% clean
req_t = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/reminders/clear', method='DELETE', headers={'Authorization': f'Bearer {token}'})
try:
    with urllib.request.urlopen(req_t, context=ctx) as r:
        print(r.read().decode())
except Exception as e:
    print("Clean script response:", e)
