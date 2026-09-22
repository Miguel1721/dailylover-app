import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT u.id, u.name, u.email, u.phone, u.client_code, p.age, p.city, p.bio_notes
            FROM users u
            JOIN profiles p ON p.user_id = u.id
            WHERE u.name ILIKE 'Cliente CRM%' AND LENGTH(TRIM(COALESCE(p.bio_notes, ''))) > 40;
        """))
        rows = res.fetchall()
        print(f"Total Cliente CRM con notas > 40: {len(rows)}")
        for r in rows:
            print(f"ID: {r[0]} | Name: {r[1]} | Email: {r[2]} | Phone: {r[3]} | Code: {r[4]} | Age: {r[5]} | City: {r[6]}")
            # check if phone or email matches another user
            if r[3]:
                dup_phone = await db.execute(text("SELECT id, name FROM users WHERE phone = :p AND id != :uid"), {"p": r[3], "uid": r[0]})
                for dp in dup_phone.fetchall():
                    print(f"   -> Match phone with UID {dp[0]}: {dp[1]}")

if __name__ == '__main__':
    asyncio.run(check())
