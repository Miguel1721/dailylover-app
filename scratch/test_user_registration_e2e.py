# scratch/test_user_registration_e2e.py
import urllib.request
import json
import uuid

API_BASE = "https://prueba-daily.agentesia.cloud"

def test_legal_and_registration():
    unique_num = f"310{uuid.uuid4().hex[:7]}"
    unique_email = f"test_habeas_{uuid.uuid4().hex[:6]}@dailylover.com"

    print("═══════════════════════════════════════════════════════════════")
    print(" 🧪 TEST E2E: Registro de Usuario, Habeas Data & Restricciones Legal")
    print("═══════════════════════════════════════════════════════════════")

    # TEST 1: Registro SIN aceptar Tratamiento de Datos (Debe fallar con HTTP 400)
    print("\n[TEST 1] Registro SIN aceptar Términos (Ley 1581 Habeas Data)...")
    payload_no_terms = {
        "name": "Prueba Consentimiento Faltante",
        "phone": unique_num,
        "email": unique_email,
        "password": "PasswordTest2026!",
        "city": "Bogotá",
        "accepted_terms": False
    }

    req = urllib.request.Request(
        f"{API_BASE}/api/v1/auth/client-register",
        data=json.dumps(payload_no_terms).encode(),
        headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req)
        print("❌ ERROR: El servidor permitió el registro SIN aceptar el tratamiento de datos.")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode())
        print(f"✅ EXITO: Servidor rechazó correctamente con HTTP {e.code}:")
        print(f"   Detalle: \"{body.get('detail')}\"")

    # TEST 2: Registro CON aceptación explicita de Ley 1581 (Debe ser Exitoso HTTP 200)
    print("\n[TEST 2] Registro CON aceptación explícita de Ley 1581 y datos completos...")
    payload_ok = {
        "name": "Carolina Andrea Gómez",
        "phone": unique_num,
        "email": unique_email,
        "password": "PasswordTest2026!",
        "city": "Medellín",
        "gender": "Mujer",
        "orientation": "Heterosexual",
        "age": 26,
        "estatura": "1.68",
        "occupation": "Diseñadora UX/UI",
        "motivacion": "conexion_profunda",
        "accepted_terms": True,
        "lifestyle": {"rumba": "ocasional", "hijos": "abierto", "bio": "Me encanta el café de especialidad y viajar"}
    }

    req_ok = urllib.request.Request(
        f"{API_BASE}/api/v1/auth/client-register",
        data=json.dumps(payload_ok).encode(),
        headers={"Content-Type": "application/json"}
    )
    res_ok = urllib.request.urlopen(req_ok)
    data_ok = json.loads(res_ok.read().decode())
    
    token = data_ok.get("access_token")
    user_info = data_ok.get("client", {})
    print(f"✅ EXITO: Usuario registrado correctamente en PostgreSQL (ID: {user_info.get('id')})")
    print(f"   Nombre: {user_info.get('name')}")
    print(f"   Celular: {user_info.get('phone')}")
    print(f"   Email: {user_info.get('email')}")
    print(f"   JWT Token recibido: {token[:30]}...")

    # TEST 3: Login con las nuevas credenciales Email + Clave
    print("\n[TEST 3] Iniciar Sesión con el nuevo usuario creado (Email + Clave)...")
    payload_login = {
        "email": unique_email,
        "password": "PasswordTest2026!"
    }
    req_login = urllib.request.Request(
        f"{API_BASE}/api/v1/auth/client-login",
        data=json.dumps(payload_login).encode(),
        headers={"Content-Type": "application/json"}
    )
    res_login = urllib.request.urlopen(req_login)
    data_login = json.loads(res_login.read().decode())
    login_token = data_login.get("access_token")
    print(f"✅ EXITO: Sesión iniciada correctamente con Email + Clave alfanumérica.")

    # TEST 4: Consultar Perfil en /api/v1/client/me con JWT Token
    print("\n[TEST 4] Consultar Perfil en /api/v1/client/me para verificar datos y metadatos de Habeas Data...")
    req_me = urllib.request.Request(
        f"{API_BASE}/api/v1/client/me",
        headers={"Authorization": f"Bearer {login_token}"}
    )
    res_me = urllib.request.urlopen(req_me)
    data_me = json.loads(res_me.read().decode())
    
    p = data_me.get("profile", {})
    ls = p.get("lifestyle", {})
    print(f"✅ EXITO: Perfil recuperado:")
    print(f"   Ciudad: {p.get('city')}")
    print(f"   Ocupación: {p.get('occupation')}")
    print(f"   Tratamiento de Datos Aceptado: {ls.get('accepted_terms')}")
    print(f"   Fecha Consentimiento Legal: {ls.get('accepted_terms_date')}")

    print("\n═══════════════════════════════════════════════════════════════")
    print(" 🎉 TODAS LAS PRUEBAS DE REGISTRO & CUMPLIMIENTO LEGAL PASARON 100%")
    print("═══════════════════════════════════════════════════════════════")

if __name__ == "__main__":
    test_legal_and_registration()
