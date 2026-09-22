import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT p.* 
            FROM profiles p
            WHERE p.user_id = 15582;
        """))
        row = res.mappings().fetchone()
        print("Sample Lead UID 15582 profile columns:")
        for k, v in row.items():
            if v is not None and str(v).strip() != "":
                print(f"  {k}: {v}")

if __name__ == '__main__':
    asyncio.run(check())
