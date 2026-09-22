import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def check_stripe_crm():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT u.id, u.name, u.email, p.plan_tier, p.bio_notes, COUNT(sp.id)
            FROM users u
            JOIN profiles p ON u.id = p.user_id
            LEFT JOIN stripe_payments sp ON sp.user_id = u.id
            WHERE u.name ILIKE 'Cliente CRM%'
            GROUP BY u.id, u.name, u.email, p.plan_tier, p.bio_notes
            HAVING COUNT(sp.id) > 0;
        """))
        print("Cliente CRM with Stripe payments:")
        for r in res.fetchall():
            print(f"  UID {r[0]} | Name: {r[1]} | Email: {r[2]} | Tier: {r[3]} | Notes len: {len(r[4] or '')} | Payments: {r[5]}")

if __name__ == '__main__':
    asyncio.run(check_stripe_crm())
