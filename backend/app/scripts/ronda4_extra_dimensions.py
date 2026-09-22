import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal
import json

async def check_new_dimensions():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT u.id, u.name, p.city, p.age, p.bio_notes
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE LENGTH(COALESCE(p.bio_notes, '')) > 40
              AND u.name IS NOT NULL
              AND u.name NOT ILIKE '%test%'
        """))
        rows = res.fetchall()
        
        emigrate = []
        devout_christians = []
        custody_shared = []
        age_gap_extreme = []
        
        for r in rows:
            notes = (r.bio_notes or "").lower()
            # 1. Emigración / Planes de mudanza / Nómada
            if any(w in notes for w in ["se va a vivir", "irse del país", "mudarse a españa", "se va a españa", "planes de emigrar", "se muda a", "nómada digital", "nomada digital", "viaja por el mundo"]):
                line = [l.strip() for l in (r.bio_notes or "").split("\n") if any(w in l.lower() for w in ["vivir", "país", "españa", "mudarse", "emigrar", "nomada", "viaja"])][:1]
                emigrate.append({"id": r.id, "name": r.name, "age": r.age, "city": r.city, "snippet": line})
                
            # 2. Cristianos devotos / Yugo desigual / Religión estricta
            if any(w in notes for w in ["yugo desigual", "muy creyente", "cristiana practicante", "cristiano practicante", "sirve en la iglesia", "asiste a la iglesia cada domingo", "imprescindible que crea en dios"]):
                line = [l.strip() for l in (r.bio_notes or "").split("\n") if any(w in l.lower() for w in ["cristian", "iglesia", "dios", "yugo", "creyente"])][:1]
                devout_christians.append({"id": r.id, "name": r.name, "age": r.age, "city": r.city, "snippet": line})
                
            # 3. Custodia compartida semana de por medio
            if any(w in notes for w in ["custodia compartida", "semana de por medio", "semana si y", "semana sí y", "semana por medio", "1 semana con", "una semana sí"]):
                line = [l.strip() for l in (r.bio_notes or "").split("\n") if any(w in l.lower() for w in ["custodia", "semana", "hijo", "niño"])][:1]
                custody_shared.append({"id": r.id, "name": r.name, "age": r.age, "city": r.city, "snippet": line})
                
        print(f"Total perfiles: {len(rows)}")
        print(f"✈️ 1. Emigración / Nómadas / Planes de mudanza: {len(emigrate)}")
        for e in emigrate[:4]:
            print(f"   - UID {e['id']} | {e['name']} ({e['age']}a, {e['city']}): {e['snippet']}")
            
        print(f"⛪ 2. Cristianos devotos / Criterio de fe estricto: {len(devout_christians)}")
        for d in devout_christians[:4]:
            print(f"   - UID {d['id']} | {d['name']} ({d['age']}a, {d['city']}): {d['snippet']}")
            
        print(f"👶 3. Custodia compartida activa (semana por medio): {len(custody_shared)}")
        for c in custody_shared[:4]:
            print(f"   - UID {c['id']} | {c['name']} ({c['age']}a, {c['city']}): {c['snippet']}")

if __name__ == '__main__':
    asyncio.run(check_new_dimensions())
