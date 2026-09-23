import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.auth_service import hash_password

ADMIN_ROLE_ID = "937990ad-5f1d-483d-b414-d38b967df2b9"
TEMP_PASSWORD = "LinaAdmin2026*"

async def configure_lina_admin():
    async with AsyncSessionLocal() as db:
        # 1. Update user_accounts
        hashed = hash_password(TEMP_PASSWORD)
        await db.execute(text("""
            UPDATE user_accounts
            SET role_id = :role_id,
                password_hash = :hash,
                status = 'active',
                must_change_password = false
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
        print(f"Temporary password set: {TEMP_PASSWORD}")

asyncio.run(configure_lina_admin())
