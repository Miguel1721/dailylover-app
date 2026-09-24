import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as s:
        r1 = await s.execute(text("SELECT DISTINCT UPPER(TRIM(psychologist_name)), COUNT(*) FROM operational_matches WHERE psychologist_name IS NOT NULL GROUP BY 1 ORDER BY 2 DESC"))
        print("operational_matches psychologist_name:")
        for row in r1.fetchall():
            print(f"  {row[0]}: {row[1]}")
            
        r2 = await s.execute(text("SELECT DISTINCT UPPER(TRIM(responsable)), COUNT(*) FROM profiles WHERE responsable IS NOT NULL GROUP BY 1 ORDER BY 2 DESC"))
        print("\nprofiles responsable:")
        for row in r2.fetchall():
            print(f"  {row[0]}: {row[1]}")

asyncio.run(check())
