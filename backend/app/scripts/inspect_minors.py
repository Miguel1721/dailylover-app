import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def check_minors_and_crimes():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text('SELECT u.id, u.crm_id, u.name, p.age FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.age IS NOT NULL AND p.age < 18 ORDER BY p.age ASC'))
        rows = res.fetchall()
        print(f"Perfiles con profiles.age < 18: {len(rows)}")
        for r in rows:
            print(f"   UID: {r[0]} | CRM: {r[1]} | {r[2]} | Edad: {r[3]}")

if __name__ == '__main__':
    asyncio.run(check_minors_and_crimes())
