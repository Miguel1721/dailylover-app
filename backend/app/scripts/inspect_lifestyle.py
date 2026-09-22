import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal
import json

async def inspect_lifestyle():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT user_id, lifestyle, search_preferences
            FROM profiles
            WHERE lifestyle IS NOT NULL AND lifestyle != '{}'::jsonb
            LIMIT 3;
        """))
        for r in res.fetchall():
            print(f"UID {r[0]}:")
            print("  lifestyle:", json.dumps(r[1], indent=2))
            print("  search_preferences:", json.dumps(r[2], indent=2))
            print("---")

if __name__ == '__main__':
    asyncio.run(inspect_lifestyle())
