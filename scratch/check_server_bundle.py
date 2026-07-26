import urllib.request, ssl, json
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

data = json.dumps({'email': 'mariapaula@dailylover.com', 'password': 'Daily2026!'}).encode()
req = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/auth/login', data=data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, context=ctx) as r:
    token = json.loads(r.read().decode()).get('access_token')

# Check which static JS file the server is serving
req2 = urllib.request.Request('https://prueba-daily.agentesia.cloud/', headers={})
with urllib.request.urlopen(req2, context=ctx) as r:
    html = r.read().decode()
    # Find the JS bundle name
    import re
    matches = re.findall(r'index-[\w\-]+\.js', html)
    print('JS bundle on server:', matches)
    print('Token OK:', bool(token))
