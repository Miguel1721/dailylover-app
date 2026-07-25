import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.auth_service import hash_password

async def seed_mp():
    async with AsyncSessionLocal() as db:
        h_pass = hash_password('Daily2026!')
        res = await db.execute(text("""
            INSERT INTO users (name, phone, email, hashed_password, created_at)
            VALUES ('María Paula', '+18134920020', 'mariapaula@dailylover.com', :pass, NOW())
            RETURNING id;
        """), {'pass': h_pass})
        uid = res.scalar()
        
        await db.execute(text("""
            INSERT INTO profiles (user_id, age, city, gender, motivacion, responsable, updated_at)
            VALUES (:uid, 30, 'Bogotá', 'Mujer', 'conexion_profunda', 'Directora / Fundadora', NOW())
            ON CONFLICT (user_id) DO NOTHING;
        """), {'uid': uid})
        await db.commit()
        print(f"María Paula user seeded successfully! User ID: {uid}")

if __name__ == "__main__":
    asyncio.run(seed_mp())
