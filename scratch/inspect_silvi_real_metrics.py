import urllib.request
import json
import ssl
import urllib.parse

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

data = json.dumps({'email': 'mariapaula@dailylover.com', 'password': 'Daily2026!'}).encode('utf-8')
req = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/auth/login', data=data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, context=ctx) as response:
    token = json.loads(response.read().decode()).get('access_token')

print("=== REAL DATABASE METRICS FOR SILVI ===")
# 1. Total assigned clients
req_u = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/users?responsable=SILVI&limit=1', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_u, context=ctx) as r:
    u_total = json.loads(r.read().decode()).get('total', 0)
    print(f"1. Total assigned clients (responsable=SILVI): {u_total}")

# 2. Total matches assigned to Silvi in database
req_m_all = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?matchmaker=SILVI&limit=1000', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_m_all, context=ctx) as r:
    res_m = json.loads(r.read().decode())
    matches = res_m.get('matches', [])
    m_total = res_m.get('total', 0)
    print(f"2. Total matches for Silvi (matchmaker=SILVI): {m_total}")

    # Count by status
    status_counts = {}
    for m in matches:
        st = (m.get('status') or 'NULL/VACIO').strip()
        status_counts[st] = status_counts.get(st, 0) + 1
    
    print("   Breakdown of statuses for Silvi's matches:")
    for st, count in status_counts.items():
        print(f"     • '{st}': {count}")

# 3. Test API with status_filter=PENDIENTE
req_p = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?matchmaker=SILVI&status_filter=PENDIENTE&limit=1', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_p, context=ctx) as r:
    p_total = json.loads(r.read().decode()).get('total', 0)
    print(f"3. API return for matchmaker=SILVI & status_filter=PENDIENTE: {p_total}")

# 4. Test API with status_filter=TROUBLE
req_t = urllib.request.Request('https://prueba-daily.agentesia.cloud/api/v1/admin/historical-matches?matchmaker=SILVI&status_filter=TROUBLE&limit=1', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_t, context=ctx) as r:
    t_total = json.loads(r.read().decode()).get('total', 0)
    print(f"4. API return for matchmaker=SILVI & status_filter=TROUBLE: {t_total}")
