# scripts/stress_test.py
# Simulación de Carga Extrema para 5,000 Usuarios en Daily Lover
# Uso: locust -f scripts/stress_test.py --host=https://prueba-daily.agentesia.cloud --users 5000 --spawn-rate 100

from locust import HttpUser, task, between, events
import os
import random
import json

# Credenciales de la cuenta de prueba: se leen del entorno, nunca del repositorio.
STRESS_EMAIL = os.environ.get("STRESS_EMAIL", "")
STRESS_PASSWORD = os.environ.get("STRESS_PASSWORD", "")

class DailyLoverUser(HttpUser):
    wait_time = between(2, 6)

    def on_start(self):
        """Simula login al iniciar sesión"""
        self.headers = {"Content-Type": "application/json"}
        # Intenta login simulado
        res = self.client.post("/api/v1/auth/client-login", json={
            "email": STRESS_EMAIL,
            "password": STRESS_PASSWORD
        }, headers=self.headers)
        if res.status_code == 200:
            token = res.json().get("access_token")
            if token:
                self.headers["Authorization"] = f"Bearer {token}"

    @task(4)
    def view_profile(self):
        """Consultar perfil del cliente activo"""
        self.client.get("/api/v1/client/me", headers=self.headers)

    @task(3)
    def view_matches(self):
        """Consultar lista de matches"""
        self.client.get("/api/v1/client/my-matches", headers=self.headers)

    @task(1)
    def health_check(self):
        """Ping de salud del servidor"""
        self.client.get("/api/health")
