import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal
import json

async def inspect_clinical_profile():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT COUNT(*),
                   COUNT(clinical_profile_360),
                   COUNT(*) FILTER (WHERE clinical_profile_360 IS NOT NULL AND clinical_profile_360 != '{}'::jsonb)
            FROM profiles;
        """))
        row = res.fetchone()
        print(f"Total profiles: {row[0]}")
        print(f"Profiles with clinical_profile_360 not null: {row[1]}")
        print(f"Profiles with clinical_profile_360 not empty: {row[2]}")
        
        # Sample one if any
        res_sample = await db.execute(text("""
            SELECT user_id, clinical_profile_360
            FROM profiles
            WHERE clinical_profile_360 IS NOT NULL AND clinical_profile_360 != '{}'::jsonb
            LIMIT 1;
        """))
        sample = res_sample.fetchone()
        if sample:
            print(f"\nSample UID {sample[0]}:")
            print(json.dumps(sample[1], indent=2)[:500])
        else:
            print("\nNo profiles have non-empty clinical_profile_360 yet!")

if __name__ == '__main__':
    asyncio.run(inspect_clinical_profile())
