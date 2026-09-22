import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def inspect():
    async with AsyncSessionLocal() as db:
        for uid in [12822, 13496, 9458, 13797]:
            res = await db.execute(text('SELECT u.id, u.name, p.bio_notes FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.id = :uid'), {'uid': uid})
            r = res.fetchone()
            if r:
                print(f"=== {r[1]} (UID {r[0]}) ===")
                text_content = r[2] or ""
                for word in ['abuso', 'sexual', 'violencia', 'droga', 'alcohol', 'adicci']:
                    idx = 0
                    while True:
                        idx = text_content.lower().find(word, idx)
                        if idx == -1:
                            break
                        start = max(0, idx - 80)
                        end = min(len(text_content), idx + 100)
                        print(f"   [{word}]: ...{text_content[start:end].replace(chr(10), ' ')}...")
                        idx += len(word)

if __name__ == '__main__':
    asyncio.run(inspect())
