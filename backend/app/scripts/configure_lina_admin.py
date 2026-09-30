import asyncio
import os
import sys
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.auth_service import hash_password

ADMIN_ROLE_ID = "937990ad-5f1d-483d-b414-d38b967df2b9"
TEMP_PASSWORD = os.environ.get("LINA_TEMP_PASSWORD", "")

async def configure_lina_admin():
    if not TEMP_PASSWORD:
        sys.exit("Falta la variable de entorno LINA_TEMP_PASSWORD (no se guarda ninguna contraseña en el código).")
    async with AsyncSessionLocal() as db:
        # 1. Update user_accounts
        hashed = hash_password(TEMP_PASSWORD)
        await db.execute(text("""
            UPDATE user_accounts
            SET role_id = :role_id,
                password_hash = :hash,
                status = 'active',
                must_change_password = true
            WHERE email = 'linamcastanedaa@gmail.com'
        """), {
            "role_id": ADMIN_ROLE_ID,
            "hash": hashed
        })

        # 2. Update employee
        await db.execute(text("""
            UPDATE employees
            SET role = 'Administradora / Operaciones',
                status = 'active'
            WHERE email = 'linamcastanedaa@gmail.com'
        """))

        await db.commit()
        print(f"Lina updated to Admin successfully!")
        print(f"Email: linamcastanedaa@gmail.com")
        print(f"Role: Admin ({ADMIN_ROLE_ID})")
        print("Temporary password set (from LINA_TEMP_PASSWORD); the user must change it on first login.")

asyncio.run(configure_lina_admin())
