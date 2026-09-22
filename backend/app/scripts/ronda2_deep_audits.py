import asyncio
import re
import json
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def ronda2_deep_audits():
    print("=====================================================================")
    print("🔬 INICIANDO RONDA 2 DE PRUEBAS EN PROFUNDIDAD SOBRE TODA LA BASE")
    print("=====================================================================\n")

    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT u.id, u.name, p.city, p.gender, p.age, p.occupation,
                   p.bio_notes, p.search_preferences, p.lifestyle
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE LENGTH(COALESCE(p.bio_notes, '')) > 20
              AND u.name IS NOT NULL
              AND u.name NOT ILIKE '%test%'
        """))
        profiles = res.fetchall()
        print(f"Total perfiles activos con notas analizados: {len(profiles)}\n")

        # 1. Cannabis / Marihuana en notas
        cannabis_cases = []
        for r in profiles:
            notes = (r.bio_notes or "").lower()
            if any(w in notes for w in ["marihuana", "cannabis", "porro", "weed", "hierba"]):
                cannabis_cases.append({
                    "id": r.id, "name": r.name, "city": r.city, "age": r.age,
                    "snippet": [line for line in (r.bio_notes or "").split('\n') if any(w in line.lower() for w in ["marihuana", "cannabis", "porro", "weed"])][:2]
                })

        print(f"🌿 1. Perfiles con mención explícita de Cannabis/Marihuana: {len(cannabis_cases)}")
        for c in cannabis_cases[:5]:
            print(f"  - UID {c['id']} | {c['name']} ({c['city']}, {c['age']}a): {c['snippet']}")

        # 2. Convivencia con Ex / Vínculo habitacional no resuelto
        ex_living_cases = []
        for r in profiles:
            notes = (r.bio_notes or "").lower()
            if any(w in notes for w in ["vive con su ex", "vive con la ex", "vive con el ex", "bajo el mismo techo con su ex", "mientras venden el apto"]):
                ex_living_cases.append({
                    "id": r.id, "name": r.name, "city": r.city, "age": r.age,
                    "snippet": [line for line in (r.bio_notes or "").split('\n') if any(w in line.lower() for w in ["ex", "techo", "venden"])][:2]
                })

        print(f"\n🏠 2. Perfiles donde convive o comparte techo con su Ex: {len(ex_living_cases)}")
        for c in ex_living_cases[:5]:
            print(f"  - UID {c['id']} | {c['name']} ({c['city']}): {c['snippet']}")

        # 3. Emigración inminente / Se va del país en corto plazo
        migration_cases = []
        for r in profiles:
            notes = (r.bio_notes or "").lower()
            if any(w in notes for w in ["se va a vivir a", "se muda a españa", "se va del país", "se va en unos meses", "visa para irse", "planes de mudarse fuera"]):
                migration_cases.append({
                    "id": r.id, "name": r.name, "city": r.city, "age": r.age,
                    "snippet": [line for line in (r.bio_notes or "").split('\n') if any(w in line.lower() for w in ["se va", "se muda", "fuera", "españa", "visa"])][:2]
                })

        print(f"\n✈️ 3. Perfiles con planes de Emigración Inminente del país: {len(migration_cases)}")
        for c in migration_cases[:5]:
            print(f"  - UID {c['id']} | {c['name']} ({c['city']}): {c['snippet']}")

        # 4. Hijos pequeños que viven con la persona vs Rechazo de hijos ajenos
        has_small_kids_cases = []
        for r in profiles:
            notes = (r.bio_notes or "").lower()
            if any(w in notes for w in ["bebé de", "hijo de 1 año", "hijo de 2 año", "hijo de 3 año", "hija de 1 año", "hija de 2 año", "hija de 3 año", "vive con su hijo pequeño"]):
                has_small_kids_cases.append({
                    "id": r.id, "name": r.name, "city": r.city, "age": r.age,
                    "snippet": [line for line in (r.bio_notes or "").split('\n') if any(w in line.lower() for w in ["hijo", "hija", "año", "bebé"])][:2]
                })

        print(f"\n👶 4. Perfiles con hijos muy pequeños (< 3 años) o bebés bajo su cuidado: {len(has_small_kids_cases)}")
        for c in has_small_kids_cases[:5]:
            print(f"  - UID {c['id']} | {c['name']} ({c['city']}): {c['snippet']}")

        # Guardar resultados
        out_data = {
            "total_analyzed": len(profiles),
            "cannabis_count": len(cannabis_cases),
            "cannabis_cases": cannabis_cases,
            "ex_living_count": len(ex_living_cases),
            "ex_living_cases": ex_living_cases,
            "migration_count": len(migration_cases),
            "migration_cases": migration_cases,
            "small_kids_count": len(has_small_kids_cases),
            "small_kids_cases": has_small_kids_cases
        }
        with open("/app/ronda2_deep_findings.json", "w", encoding="utf-8") as out:
            json.dump(out_data, out, ensure_ascii=False, indent=2)

        print("\n✅ Ronda 2 guardada en /app/ronda2_deep_findings.json")

if __name__ == "__main__":
    asyncio.run(ronda2_deep_audits())
