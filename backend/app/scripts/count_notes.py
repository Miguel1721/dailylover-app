import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as db:
        r1 = await db.execute(text('SELECT COUNT(*) FROM profiles WHERE LENGTH(bio_notes) > 200'))
        print('Profiles with bio_notes > 200:', r1.scalar())
        r2 = await db.execute(text('SELECT COUNT(*) FROM profiles WHERE LENGTH(bio_notes) > 1000'))
        print('Profiles with bio_notes > 1000:', r2.scalar())
        r3 = await db.execute(text('SELECT COUNT(*) FROM profiles WHERE LENGTH(bio_notes) > 2500'))
        print('Profiles with bio_notes > 2500:', r3.scalar())

if __name__ == '__main__':
    asyncio.run(check())
