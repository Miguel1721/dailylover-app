import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT p.module, p.action 
            FROM role_permissions rp 
            JOIN permissions p ON p.id = rp.permission_id 
            WHERE rp.role_id = '937990ad-5f1d-483d-b414-d38b967df2b9' 
            ORDER BY p.module, p.action
        """))
        rows = res.fetchall()
        print(f"Admin has {len(rows)} permissions:")
        for r in rows:
            print(f" - {r.module}.{r.action}")

asyncio.run(check())
