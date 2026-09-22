import asyncio
import re
import json
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def ronda3_deep_scan():
    print("=====================================================================")
    print("🔬 INICIANDO RONDA 3 DE AUDITORÍA PROFUNDA: PUNTOS CIEGOS CLÍNICOS")
    print("=====================================================================\n")

    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT u.id, u.name, p.city, p.gender, p.age, p.occupation,
                   p.bio_notes, p.search_preferences, p.lifestyle
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE LENGTH(COALESCE(p.bio_notes, '')) > 30
              AND u.name IS NOT NULL
              AND u.name NOT ILIKE '%test%'
        """))
        profiles = res.fetchall()
        print(f"Total perfiles con notas analizados: {len(profiles)}\n")

        # 1. Hijos en notas vs has_children == 'No' en CRM
        ghost_children = []
        for r in profiles:
            sp = r.search_preferences or {}
            ls = r.lifestyle or {}
            crm_has_kids = sp.get('has_children') or ls.get('has_children')
            notes = (r.bio_notes or "").lower()

            # If CRM says 'No' or is empty/None, but notes prove having children
            if str(crm_has_kids).lower() in ['no', 'false', 'none', '']:
                # search for patterns like 'tiene un hijo', 'tiene una hija', 'mamá de', 'papá de', 'hijo de X años'
                m = re.search(r'(tiene \d+ hij[oa]s?|tiene un hijo|tiene una hija|mam[aá] soltera|pap[aá] soltero|hijo de \d+|hija de \d+|hijos: \d+|es mam[aá]|es pap[aá]|su hij[oa])', notes)
                if m and not any(neg in m.group(0) for neg in ["no tiene", "quiere", "desea", "gustaría"]):
                    # verify it's not "su hermana tiene un hijo" or "no quiere personas con hijos"
                    # extract context snippet
                    idx = notes.find(m.group(0))
                    start = max(0, idx - 40)
                    end = min(len(notes), idx + 80)
                    context = notes[start:end].replace('\n', ' ')
                    if not any(f in context for f in ["hermana", "amiga", "prima", "tía", "no tiene", "no quiere", "no busca"]):
                        ghost_children.append({
                            "id": r.id,
                            "name": r.name,
                            "crm_has_kids": crm_has_kids,
                            "match": m.group(0),
                            "context": context
                        })

        print(f"👶 1. Hijos reales en Notas pero 'has_children: No' en CRM: {len(ghost_children)} casos")
        for c in ghost_children[:6]:
            print(f"  - UID {c['id']} | {c['name']} (CRM dice: {c['crm_has_kids']}): ...{c['context']}...")

        # 2. Visión del Dinero: "No 50/50 / Hombre Proveedor" vs "50/50 Estricto / Independiente"
        provider_mentality = []
        strict_split = []
        for r in profiles:
            notes = (r.bio_notes or "").lower()
            if any(w in notes for w in ["no 50/50", "no soporta el 50/50", "hombre proveedor", "sea proveedor", "no le gusta el 50/50", "tradicional que pague", "hombre que resuelva"]):
                provider_mentality.append({
                    "id": r.id, "name": r.name, "city": r.city, "age": r.age,
                    "snippet": [l.strip() for l in (r.bio_notes or "").split('\n') if any(w in l.lower() for w in ["50/50", "proveedor", "resuelva"])][:2]
                })
            if any(w in notes for w in ["50/50", "cada uno lo suyo", "finanzas separadas", "no mantener", "no dar derechos de esposa", "no busca quien la mantenga", "no busca quien lo mantenga"]):
                strict_split.append({
                    "id": r.id, "name": r.name, "city": r.city, "age": r.age,
                    "snippet": [l.strip() for l in (r.bio_notes or "").split('\n') if any(w in l.lower() for w in ["50/50", "finanzas", "mantenga", "esposa"])][:2]
                })

        print(f"\n💰 2. Mentalidad Económica:")
        print(f"  - Exige 'Hombre Proveedor / Cero 50-50': {len(provider_mentality)} perfiles")
        for p in provider_mentality[:4]:
            print(f"    * UID {p['id']} | {p['name']}: {p['snippet']}")
        print(f"  - Exige '50-50 Estricto / Finanzas Separadas / No Mantener': {len(strict_split)} perfiles")
        for s in strict_split[:4]:
            print(f"    * UID {s['id']} | {s['name']}: {s['snippet']}")

        # 3. Matrimonio formal inmediato vs Rechazo frontal a casarse
        must_marry = []
        anti_marriage = []
        for r in profiles:
            notes = (r.bio_notes or "").lower()
            if any(w in notes for w in ["casarse por la iglesia", "quiere casarse", "sueño de casarse", "matrimonio sagrado"]):
                must_marry.append(r.id)
            if any(w in notes for w in ["no se quiere casar", "no cree en el matrimonio", "cero matrimonio", "purga del matrimonio", "no volver a casarse"]):
                anti_marriage.append({
                    "id": r.id, "name": r.name,
                    "snippet": [l.strip() for l in (r.bio_notes or "").split('\n') if any(w in l.lower() for w in ["casar", "matrimonio"])]
                })

        print(f"\n💍 3. Visión de Matrimonio:")
        print(f"  - Prioridad de Matrimonio / Casarse: {len(must_marry)} perfiles")
        print(f"  - Rechazo Frontal al Matrimonio: {len(anti_marriage)} perfiles")
        for a in anti_marriage[:4]:
            print(f"    * UID {a['id']} | {a['name']}: {a['snippet']}")

        # 4. Estatura: Incompatibilidades estrictas en notas
        height_strict = []
        for r in profiles:
            notes = (r.bio_notes or "").lower()
            if any(w in notes for w in ["mínimo 1.8", "minimo 1.8", "mínimo 1.85", "minimo 1.85", "más de 1.80", "mas de 1.80", "no bajitos", "no bajito", "no hombres de menor estatura", "más alto que ella"]):
                height_strict.append(r.id)
        print(f"\n📏 4. Perfiles con exigencia estricta de estatura alta en notas: {len(height_strict)} perfiles")

        out = {
            "total_analyzed": len(profiles),
            "ghost_children_count": len(ghost_children),
            "ghost_children": ghost_children,
            "provider_count": len(provider_mentality),
            "provider_cases": provider_mentality,
            "strict_split_count": len(strict_split),
            "strict_split_cases": strict_split,
            "anti_marriage_count": len(anti_marriage),
            "anti_marriage_cases": anti_marriage,
            "height_strict_count": len(height_strict)
        }

        with open("/app/ronda3_deep_findings.json", "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)

        print("\n✅ Ronda 3 guardada en /app/ronda3_deep_findings.json")

if __name__ == '__main__':
    asyncio.run(ronda3_deep_scan())
