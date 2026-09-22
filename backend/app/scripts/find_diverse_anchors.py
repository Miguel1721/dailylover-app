import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def find_diverse_anchors():
    async with AsyncSessionLocal() as db:
        # Search by diverse age, city, and notes depth
        queries = [
            ("Senior 50+ Hombre", "SELECT p.user_id, u.name, p.age, p.city, p.gender, p.occupation, LENGTH(p.bio_notes) FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.gender = 'Hombre' AND p.age >= 50 AND LENGTH(p.bio_notes) > 300 LIMIT 3;"),
            ("Senior 45+ Mujer", "SELECT p.user_id, u.name, p.age, p.city, p.gender, p.occupation, LENGTH(p.bio_notes) FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.gender = 'Mujer' AND p.age >= 45 AND LENGTH(p.bio_notes) > 300 LIMIT 3;"),
            ("Joven 20-26 Mujer", "SELECT p.user_id, u.name, p.age, p.city, p.gender, p.occupation, LENGTH(p.bio_notes) FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.gender = 'Mujer' AND p.age BETWEEN 20 AND 26 AND LENGTH(p.bio_notes) > 300 LIMIT 3;"),
            ("Joven 20-26 Hombre", "SELECT p.user_id, u.name, p.age, p.city, p.gender, p.occupation, LENGTH(p.bio_notes) FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.gender = 'Hombre' AND p.age BETWEEN 20 AND 26 AND LENGTH(p.bio_notes) > 300 LIMIT 3;"),
            ("Medellín", "SELECT p.user_id, u.name, p.age, p.city, p.gender, p.occupation, LENGTH(p.bio_notes) FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.city ILIKE 'Medell%' AND LENGTH(p.bio_notes) > 300 LIMIT 3;"),
            ("Cali", "SELECT p.user_id, u.name, p.age, p.city, p.gender, p.occupation, LENGTH(p.bio_notes) FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.city ILIKE 'Cali%' AND LENGTH(p.bio_notes) > 200 LIMIT 3;"),
            ("Barranquilla", "SELECT p.user_id, u.name, p.age, p.city, p.gender, p.occupation, LENGTH(p.bio_notes) FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.city ILIKE 'Barranquilla%' AND LENGTH(p.bio_notes) > 200 LIMIT 3;"),
            ("Homosexual / Lesbiana", "SELECT p.user_id, u.name, p.age, p.city, p.gender, p.occupation, LENGTH(p.bio_notes) FROM profiles p JOIN users u ON u.id = p.user_id WHERE (p.orientation ILIKE '%homo%' OR p.orientation ILIKE '%lesb%') AND LENGTH(p.bio_notes) > 200 LIMIT 3;"),
            ("Con Vasectomía", "SELECT p.user_id, u.name, p.age, p.city, p.gender, p.occupation, LENGTH(p.bio_notes) FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.bio_notes ILIKE '%vasectom%' LIMIT 3;"),
            ("Turnos / Rotación / Petrolero", "SELECT p.user_id, u.name, p.age, p.city, p.gender, p.occupation, LENGTH(p.bio_notes) FROM profiles p JOIN users u ON u.id = p.user_id WHERE (p.bio_notes ILIKE '%turno%' OR p.bio_notes ILIKE '%rotac%' OR p.bio_notes ILIKE '%petrol%') LIMIT 3;")
        ]

        print("=== CANDIDATOS ANCLA DIVERSOS EN LA BASE DE DATOS SANEADA ===")
        for category, q in queries:
            print(f"\n--- {category} ---")
            res = await db.execute(text(q))
            for r in res.fetchall():
                print(f"  UID {r[0]} | {r[1]} | {r[2]}a | {r[3]} | {r[4]} | {r[5]} | Notes: {r[6]}c")

if __name__ == '__main__':
    asyncio.run(find_diverse_anchors())
