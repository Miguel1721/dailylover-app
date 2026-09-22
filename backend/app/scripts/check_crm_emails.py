import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def check_crm_emails():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT 
                COUNT(*) total,
                COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '') with_email,
                COUNT(*) FILTER (WHERE email IS NULL OR email = '') without_email
            FROM users
            WHERE name ILIKE 'Cliente CRM%';
        """))
        row = res.fetchone()
        print(f"Total 'Cliente CRM%': {row[0]}")
        print(f"  Con email real: {row[1]}")
        print(f"  Sin email (100% vacíos): {row[2]}")

if __name__ == '__main__':
    asyncio.run(check_crm_emails())
