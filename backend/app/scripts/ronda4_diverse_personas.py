import asyncio
import re
import json
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def ronda4_personas():
    print("=====================================================================")
    print("🔬 RONDA 4: ARQUETIPOS DIVERSOS Y ANÁLISIS CLÍNICOS ESPECIALIZADOS")
    print("=====================================================================\n")

    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT u.id, u.name, p.city, p.gender, p.age, p.occupation,
                   p.bio_notes, p.search_preferences, p.lifestyle
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE LENGTH(COALESCE(p.bio_notes, '')) > 40
              AND u.name IS NOT NULL
              AND u.name NOT ILIKE '%test%'
        """))
        profiles = res.fetchall()
        print(f"Total perfiles con notas clínicas analizados: {len(profiles)}\n")

        # 1. Arquetipo: Senior 50+ (Dinámica de vida, hijos adultos, divorcios)
        seniors = []
        for r in profiles:
            age = r.age
            notes = (r.bio_notes or "").lower()
            if (age and age >= 50) or "50 años" in notes or "55 años" in notes or "60 años" in notes:
                seniors.append({
                    "id": r.id, "name": r.name, "age": age, "city": r.city, "gender": r.gender,
                    "occupation": r.occupation,
                    "snippet": [l.strip() for l in (r.bio_notes or "").split('\n') if any(w in l.lower() for w in ["divorci", "hijos", "busca", "edad", "pension", "salario"])][:3]
                })

        print(f"👴 1. Arquetipo Senior (50+ años): {len(seniors)} perfiles en la base")
        for s in seniors[:4]:
            print(f"  - UID {s['id']} | {s['name']} ({s['age']}a, {s['city']}, {s['occupation']}): {s['snippet']}")

        # 2. Arquetipo: Astrología / Energías / Esoterismo vs Racionalismo Antiesotérico
        astrology_believers = []
        astrology_skeptics = []
        for r in profiles:
            notes = (r.bio_notes or "").lower()
            if any(w in notes for w in ["astrología", "carta astral", "signo", "constelaciones", "energías", "escorpio", "tauro", "leo"]):
                astrology_believers.append({"id": r.id, "name": r.name, "city": r.city, "notes": notes[:150]})
            if any(w in notes for w in ["cero esoterismo", "no astrología", "no cartas astrales", "cero cartas", "no energías", "muy racional"]):
                astrology_skeptics.append({"id": r.id, "name": r.name, "city": r.city, "notes": notes[:150]})

        print(f"\n🔮 2. Esoterismo y Astrología:")
        print(f"  - Creyentes en Astrología / Signos / Energías en notas: {len(astrology_believers)} perfiles")
        print(f"  - Escépticos / No toleran astrología o esoterismo: {len(astrology_skeptics)} perfiles")

        # 3. Arquetipo: Neurodivergencia y Salud Mental Revelada en Notas (TDAH, Ansiedad, Terapia)
        mental_health = []
        for r in profiles:
            notes = (r.bio_notes or "").lower()
            m = re.search(r'(tdah|ansiedad medicada|depresi[oó]n|terapia hace|va a terapia|psic[oó]loga semanal|trastorno)', notes)
            if m:
                # exclude common non-clinical phrases
                line = [l.strip() for l in (r.bio_notes or "").split('\n') if any(w in l.lower() for w in ["tdah", "terapia", "ansiedad", "depresi"])][:2]
                mental_health.append({
                    "id": r.id, "name": r.name, "age": r.age, "gender": r.gender, "city": r.city,
                    "snippet": line
                })

        print(f"\n🧠 3. Salud Mental y Crecimiento Personal en Notas (Terapia / TDAH / Ansiedad): {len(mental_health)} perfiles")
        for m in mental_health[:4]:
            print(f"  - UID {m['id']} | {m['name']} ({m['age']}a, {m['city']}): {m['snippet']}")

        # 4. Arquetipo: Alimentación y Restricciones Éticas (Vegano / Vegetariano estricto vs Carnívoro)
        vegans = []
        carnivores = []
        for r in profiles:
            notes = (r.bio_notes or "").lower()
            if any(w in notes for w in ["vegan[oa]", "vegetarian[oa]", "no consume carne"]):
                vegans.append({"id": r.id, "name": r.name, "city": r.city, "age": r.age, "snippet": [l.strip() for l in (r.bio_notes or "").split('\n') if "vege" in l.lower() or "carne" in l.lower()][:1]})
            if any(w in notes for w in ["carnívoro", "asados", "le encanta la carne", "ama la carne"]):
                carnivores.append({"id": r.id, "name": r.name, "city": r.city, "age": r.age})

        print(f"\n🥗 4. Hábitos Alimentarios Éticos / Restricciones:")
        print(f"  - Veganos / Vegetarianos en notas: {len(vegans)} perfiles")
        print(f"  - Carnívoros declarados / Amantes de asados: {len(carnivores)} perfiles")
        for v in vegans[:3]:
            print(f"    * Vegano UID {v['id']} | {v['name']}: {v['snippet']}")

        # 5. Arquetipo: Horarios Incompatibles de Trabajo (Turnos de Noche / Pilotos / Médicos de Urgencias)
        shift_workers = []
        for r in profiles:
            notes = (r.bio_notes or "").lower()
            if any(w in notes for w in ["turnos de noche", "turno rotativo", "piloto de", "guardias de", "turnos 12 horas", "trabaja de noche"]):
                shift_workers.append({
                    "id": r.id, "name": r.name, "city": r.city, "age": r.age, "occupation": r.occupation,
                    "snippet": [l.strip() for l in (r.bio_notes or "").split('\n') if any(w in l.lower() for w in ["turno", "noche", "guardia", "piloto"])][:1]
                })

        print(f"\n⏰ 5. Horarios Complejos (Turnos Rotativos / Nocturnos / Pilotos): {len(shift_workers)} perfiles")
        for sw in shift_workers[:4]:
            print(f"  - UID {sw['id']} | {sw['name']} ({sw['occupation']}): {sw['snippet']}")

        out = {
            "total_analyzed": len(profiles),
            "seniors_count": len(seniors),
            "seniors": seniors[:20],
            "astrology_believers_count": len(astrology_believers),
            "astrology_skeptics_count": len(astrology_skeptics),
            "mental_health_count": len(mental_health),
            "mental_health_sample": mental_health[:20],
            "vegans_count": len(vegans),
            "vegans_sample": vegans[:15],
            "shift_workers_count": len(shift_workers),
            "shift_workers_sample": shift_workers[:20]
        }

        with open("/app/ronda4_personas_findings.json", "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)

        print("\n✅ Ronda 4 guardada en /app/ronda4_personas_findings.json")

if __name__ == '__main__':
    asyncio.run(ronda4_personas())
