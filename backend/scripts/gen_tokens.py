import asyncio
from app.services.auth_service import create_access_token
from app.database import get_db
from sqlalchemy import text

async def main():
    async for db in get_db():
        emails = [
            "admin@dailylover.co", 
            "mariapaula@dailylover.com", 
            "linamcastanedaa@gmail.com", 
            "valentina.ospina1406@gmail.com", 
            "anatolosaamado@gmail.com"
        ]
        for email in emails:
            row = (await db.execute(text("SELECT id, role_id, email FROM user_accounts WHERE email = :e"), {"e": email})).mappings().first()
            if row:
                tok = create_access_token(str(row["id"]), str(row["role_id"]) if row["role_id"] else None)
                print(f"USER: {row['email']} | TOKEN: {tok}")
            else:
                print(f"USER: {email} NOT FOUND")
        break

if __name__ == "__main__":
    asyncio.run(main())
