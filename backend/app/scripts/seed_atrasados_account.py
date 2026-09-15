"""
Seed script to create/ensure the 'atrasados_only' role and the restricted user account
'maria.atrasados@dailylover.com' in the PostgreSQL database.
"""
import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.auth_service import hash_password

async def seed_atrasados():
    async with AsyncSessionLocal() as db:
        print("[SEED] Ensuring role 'atrasados_only' exists...")
        await db.execute(text("""
            INSERT INTO roles (name, is_system) 
            VALUES ('atrasados_only', false)
            ON CONFLICT (name) DO NOTHING;
        """))
        
        r_res = await db.execute(text("SELECT id FROM roles WHERE name = 'atrasados_only'"))
        role_id = r_res.scalar()
        print(f"[SEED] Role 'atrasados_only' ID: {role_id}")

        print("[SEED] Creating/updating user 'maria.atrasados@dailylover.com'...")
        pwd_hash = hash_password('MariaAtrasados2026!*')
        await db.execute(text("""
            INSERT INTO user_accounts (email, password_hash, role_id, status, must_change_password)
            VALUES ('maria.atrasados@dailylover.com', :pwd, :rid, 'active', false)
            ON CONFLICT (email) DO UPDATE 
            SET password_hash = :pwd, role_id = :rid, status = 'active', must_change_password = false;
        """), {'pwd': pwd_hash, 'rid': role_id})

        await db.commit()
        print("[SEED] User 'maria.atrasados@dailylover.com' configured successfully with role 'atrasados_only'.")

if __name__ == "__main__":
    asyncio.run(seed_atrasados())
