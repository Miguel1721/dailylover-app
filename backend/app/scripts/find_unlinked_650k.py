import asyncio
from app.database import engine
import sqlalchemy as sa

async def find_unlinked():
    async with engine.connect() as c:
        for q in ["laura", "pardo", "mejia", "viveros", "triana"]:
            r = await c.execute(sa.text("""
                SELECT u.id, u.name, u.email, p.plan_tier, p.responsable
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                WHERE lower(u.name) LIKE :q OR lower(u.email) LIKE :q
                LIMIT 10
            """), {"q": f"%{q}%"})
            rows = r.fetchall()
            print(f"Query '{q}': {len(rows)} matches")
            for row in rows:
                print("  ", row)

if __name__ == "__main__":
    asyncio.run(find_unlinked())
