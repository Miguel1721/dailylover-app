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

filename = r'C:\Users\jeloz\Downloads\Daily Lover MATCHMAKING.xlsx'
boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'

with open(filename, 'rb') as f:
    file_bytes = f.read()

part1 = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="Daily Lover MATCHMAKING.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'.encode('utf-8')
part2 = f'\r\n--{boundary}--\r\n'.encode('utf-8')
body = part1 + file_bytes + part2

req_upload = urllib.request.Request(
    'https://prueba-daily.agentesia.cloud/api/v1/admin/sync-plans',
    data=body,
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    }
)

try:
    with urllib.request.urlopen(req_upload, context=ctx) as resp_upload:
        res = json.loads(resp_upload.read().decode())
        print('PROD PLAN SYNC SUCCESSFUL:', json.dumps(res, indent=2))
except Exception as e:
    print('Upload error:', e)
