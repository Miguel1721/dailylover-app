import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT ua.id, ua.email, ua.role_id, ua.status, ua.must_change_password,
                   ua.password_hash IS NOT NULL as has_pwd, r.name as role_name, e.full_name
            FROM user_accounts ua
            LEFT JOIN roles r ON r.id = ua.role_id
            LEFT JOIN employees e ON e.id = ua.employee_id
            WHERE ua.email ILIKE '%lina%' OR e.full_name ILIKE '%lina%'
        """))
        rows = res.fetchall()
        print(f"Found {len(rows)} matching accounts:")
        for r in rows:
            print(dict(r._mapping))

        # Check Admin role id
        r_res = await db.execute(text("SELECT id, name FROM roles WHERE name ILIKE '%admin%'"))
        print("\nAdmin roles:")
        for r in r_res.fetchall():
            print(dict(r._mapping))

asyncio.run(check())
