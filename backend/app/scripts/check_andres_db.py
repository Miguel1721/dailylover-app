import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT user_id, age, bio_notes FROM profiles WHERE user_id = 9567"))
        row = res.fetchone()
        print("UID 9567 age:", row.age if row else None)
        print("UID 9567 notes snippet:", row.bio_notes[:200] if row and row.bio_notes else None)

if __name__ == '__main__':
    asyncio.run(main())
