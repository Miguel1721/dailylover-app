"""
setup_test_users.py
Crea usuarios de prueba con roles limitados para validar RBAC.
También crea una cuenta con must_change_password=true para testear el flujo.
"""
import asyncio
import sys
sys.path.insert(0, '/app')

from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.auth_service import hash_password

TEST_USERS = [
    {
        "email": "ventas@dailylover.co",
        "password": "ventas2024",
        "role_name": "Ventas",
        "must_change": False,
        "description": "Usuario de ventas con acceso a clientes y eventos",
    },
    {
        "email": "finanzas@dailylover.co",
        "password": "finanzas2024",
        "role_name": "Finanzas",
        "must_change": False,
        "description": "Usuario de finanzas con acceso a modulos contables",
    },
    {
        "email": "nueva@dailylover.co",
        "password": "cambiar123",
        "role_name": "Ventas",
        "must_change": True,
        "description": "Cuenta nueva que DEBE cambiar contrasena en primer login",
    },
]

async def main():
    async with AsyncSessionLocal() as db:
        print("\n[SETUP] Iniciando configuracion de usuarios de prueba...\n")

        # 1. Listar roles existentes
        roles_res = await db.execute(text("SELECT id, name FROM roles ORDER BY name"))
        roles = {r.name: r.id for r in roles_res.fetchall()}
        print(f"[ROLES] Encontrados: {list(roles.keys())}")

        # 2. Verificar/crear roles si no existen
        needed = {"Ventas", "Finanzas"}
        for role_name in needed:
            if role_name not in roles:
                print(f"[ROLES] Creando rol: {role_name}")
                res = await db.execute(text("""
                    INSERT INTO roles (name, description, is_system)
                    VALUES (:name, :desc, false)
                    ON CONFLICT (name) DO NOTHING
                    RETURNING id, name
                """), {"name": role_name, "desc": f"Rol de {role_name}"})
                row = res.fetchone()
                if row:
                    roles[row.name] = row.id

        # 3. Asignar permisos minimos a Ventas
        ventas_perms = ["clientes.view", "clientes.create", "clientes.edit",
                        "eventos.view", "eventos.create", "dashboard.view"]
        if "Ventas" in roles:
            for perm in ventas_perms:
                module, action = perm.split(".")
                await db.execute(text("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT :role_id, p.id FROM permissions p
                    WHERE p.module = :module AND p.action = :action
                    ON CONFLICT DO NOTHING
                """), {"role_id": roles["Ventas"], "module": module, "action": action})
            print(f"[PERMS] Ventas -> {', '.join(ventas_perms)}")

        # 4. Asignar permisos minimos a Finanzas
        finanzas_perms = ["dashboard.view", "ingresos.view", "ingresos.create",
                          "gastos.view", "gastos.create", "flujo_caja.view",
                          "nomina.view", "comisiones.view"]
        if "Finanzas" in roles:
            for perm in finanzas_perms:
                module, action = perm.split(".")
                await db.execute(text("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT :role_id, p.id FROM permissions p
                    WHERE p.module = :module AND p.action = :action
                    ON CONFLICT DO NOTHING
                """), {"role_id": roles["Finanzas"], "module": module, "action": action})
            print(f"[PERMS] Finanzas -> {', '.join(finanzas_perms)}")

        await db.commit()

        # 5. Crear usuarios de prueba
        print("\n[USERS] Creando usuarios de prueba...")
        for u in TEST_USERS:
            role_id = roles.get(u["role_name"])
            if not role_id:
                print(f"  WARNING Rol '{u['role_name']}' no encontrado, saltando {u['email']}")
                continue

            pw_hash = hash_password(u["password"])
            res = await db.execute(text("""
                INSERT INTO user_accounts (email, password_hash, role_id, status, must_change_password)
                VALUES (:email, :pw, :role_id, 'active', :must_change)
                ON CONFLICT (email) DO UPDATE
                SET password_hash = :pw,
                    role_id = :role_id,
                    must_change_password = :must_change,
                    status = 'active'
                RETURNING id
            """), {
                "email": u["email"],
                "pw": pw_hash,
                "role_id": role_id,
                "must_change": u["must_change"]
            })
            uid = res.fetchone()
            flag = "[MUST CHANGE]" if u["must_change"] else "[OK]"
            print(f"  {flag} {u['email']} / {u['password']} -> rol: {u['role_name']}")
            print(f"     desc: {u['description']}")

        await db.commit()

        # 6. Verificar conteo final
        count_res = await db.execute(text(
            "SELECT COUNT(*) FROM user_accounts WHERE status='active'"
        ))
        total = count_res.scalar()
        print(f"\n[OK] Total cuentas activas en el sistema: {total}")

        # 7. Resumen de permisos por rol
        print("\n[RBAC] Resumen de permisos por rol:")
        rbac_res = await db.execute(text("""
            SELECT r.name as rol, r.is_system, COUNT(rp.permission_id) as perms
            FROM roles r
            LEFT JOIN role_permissions rp ON rp.role_id = r.id
            GROUP BY r.name, r.is_system
            ORDER BY r.name
        """))
        for row in rbac_res.fetchall():
            marker = "SUPERADMIN (todos)" if row.is_system else f"{row.perms} permisos"
            print(f"  {row.rol}: {marker}")

        print("\n[DONE] Setup completo.\n")

asyncio.run(main())
