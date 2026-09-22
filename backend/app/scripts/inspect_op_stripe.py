import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def inspect_crm_operational_stripe():
    async with AsyncSessionLocal() as db:
        print("--- Operational matches for Cliente CRM% ---")
        res_op = await db.execute(text("""
            SELECT om.id, om.user_id_a, u.name, om.status, om.created_at
            FROM operational_matches om
            JOIN users u ON u.id = om.user_id_a
            WHERE u.name ILIKE 'Cliente CRM%';
        """))
        for r in res_op.fetchall():
            print(f"  Match ID {r[0]} | User A: {r[1]} ({r[2]}) | Status: {r[3]} | Created: {r[4]}")

        print("\n--- Stripe payments for Cliente CRM% ---")
        res_str = await db.execute(text("""
            SELECT sp.id, sp.user_id, u.name, sp.amount, sp.created_at
            FROM stripe_payments sp
            JOIN users u ON u.id = sp.user_id
            WHERE u.name ILIKE 'Cliente CRM%'
            LIMIT 5;
        """))
        for r in res_str.fetchall():
            print(f"  Payment ID {r[0]} | User: {r[1]} ({r[2]}) | Amount: {r[3]} | Created: {r[4]}")

if __name__ == '__main__':
    asyncio.run(inspect_crm_operational_stripe())
