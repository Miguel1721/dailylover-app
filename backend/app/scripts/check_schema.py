import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def check_tables():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """))
        tables = [r[0] for r in res.fetchall()]
        print("Tables in DB:", tables)
        
        # Check columns of profiles
        res_cols = await db.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'profiles'
            ORDER BY ordinal_position;
        """))
        print("\nColumns in profiles:")
        for c in res_cols.fetchall():
            print(f"  {c[0]} ({c[1]})")

if __name__ == '__main__':
    asyncio.run(check_tables())
