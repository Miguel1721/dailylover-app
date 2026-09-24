import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT date_time, had_date, feedback, count(*) 
            FROM scheduled_dates 
            WHERE date_time IS NOT NULL AND TRIM(date_time) != '' 
            GROUP BY date_time, had_date, feedback 
            ORDER BY count(*) DESC 
            LIMIT 25
        """))
        print("SAMPLE DATE_TIME VALUES:")
        for r in res.fetchall():
            print(f"Date: '{r[0]}' | had_date: {r[1]} | fb: '{r[2]}' | count: {r[3]}")

if __name__ == '__main__':
    asyncio.run(check())
