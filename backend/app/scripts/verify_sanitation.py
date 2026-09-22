import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal
import json

async def verify_sanitation():
    async with AsyncSessionLocal() as db:
        # 1. Check Daniella Lozada
        res1 = await db.execute(text("SELECT user_id, gender FROM profiles WHERE user_id = 13747;"))
        r1 = res1.fetchone()
        print(f"Daniella Lozada (UID 13747) gender: {r1[1]}")
        
        # 2. Check Daniel Moreno city
        res2 = await db.execute(text("SELECT user_id, city FROM profiles WHERE user_id = 7195;"))
        r2 = res2.fetchone()
        print(f"Daniel Moreno (UID 7195) city: '{r2[1]}'")
        
        # 3. Check Laura Montiel city
        res3 = await db.execute(text("SELECT user_id, city FROM profiles WHERE user_id = 6529;"))
        r3 = res3.fetchone()
        print(f"Laura Montiel (UID 6529) city: '{r3[1]}'")
        
        # 4. Check Angel Arteaga has_children
        res4 = await db.execute(text("SELECT user_id, lifestyle->>'has_children' FROM profiles WHERE user_id = 9702;"))
        r4 = res4.fetchone()
        print(f"Angel Arteaga (UID 9702) has_children: '{r4[1]}'")
        
        # 5. Check availability status distribution
        res5 = await db.execute(text("SELECT lifestyle->>'availability_status', COUNT(*) FROM profiles GROUP BY 1 ORDER BY 2 DESC;"))
        print("\nAvailability status in DB:")
        for r in res5.fetchall():
            print(f"  {r[0]}: {r[1]}")

if __name__ == '__main__':
    asyncio.run(verify_sanitation())
