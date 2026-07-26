import requests

API = "https://prueba-daily.agentesia.cloud"
resp = requests.post(f"{API}/api/v1/auth/login", json={"email": "mariapaula@dailylover.com", "password": "Daily2026!"})
token = resp.json()["access_token"]

r = requests.get(f"{API}/api/v1/admin/historical-matches?page=1&limit=15", headers={"Authorization": f"Bearer {token}"})
print("Status:", r.status_code)
print("Response:", r.text[:500])
