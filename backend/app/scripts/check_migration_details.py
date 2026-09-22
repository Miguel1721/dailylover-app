import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as db:
        fk_prof = await db.execute(text("""
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'profiles'::regclass AND contype = 'f';
        """))
        for f in fk_prof.fetchall():
            print(f'FK in profiles: {f[0]} -> {f[1]}')

if __name__ == '__main__':
    asyncio.run(check())
