import asyncio
import re
from sqlalchemy import text
from app.database import AsyncSessionLocal

STATUS_KEYWORDS = [
    r'refound',
    r'reembolso',
    r'no quiere m[aá]s matches',
    r'elimin[ea]r sus datos',
    r'no nos volvi[oó] a contestar',
    r'no volvi[oó] a responder',
    r'est[aá] saliendo con',
    r'ya est[aá] de novi[oa]',
    r'se cas[oó]',
    r'inactiv[oa] por',
    r'pidi[oó] congelar',
    r'cuenta congelada',
    r'no est[aá] disponible'
]

async def check_inactive_in_notes():
    print("Scanning active database profiles for operational status notes...")
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT u.id, u.name, p.city, p.gender, p.bio_notes
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE LENGTH(p.bio_notes) > 20
              AND u.name IS NOT NULL
              AND u.name NOT ILIKE '%test%'
        """))
        rows = res.fetchall()
        print(f"Total profiles with notes: {len(rows)}")

        flagged = []
        for r in rows:
            notes_start = (r.bio_notes or "")[:200].lower()
            for kw in STATUS_KEYWORDS:
                if re.search(kw, notes_start):
                    flagged.append({
                        "user_id": r.id,
                        "name": r.name,
                        "city": r.city,
                        "matched_kw": kw,
                        "header": (r.bio_notes or "")[:120].replace('\n', ' ')
                    })
                    break

        print(f"\n🚨 FOUND {len(flagged)} PROFILES with operational status flags in their notes header!")
        for f in flagged[:15]:
            print(f"- UID {f['user_id']} | {f['name']} ({f['city']}) | Keyword: '{f['matched_kw']}'")
            print(f"  Header: {f['header']}\n")

if __name__ == '__main__':
    asyncio.run(check_inactive_in_notes())
