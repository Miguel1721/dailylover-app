import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT *
            FROM employees
            WHERE email ILIKE '%lina%' OR full_name ILIKE '%lina%'
        """))
        rows = res.fetchall()
        print(f"Employees found: {len(rows)}")
        for r in rows:
            print(dict(r._mapping))

asyncio.run(check())
