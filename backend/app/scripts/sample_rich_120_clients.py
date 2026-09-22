"""
Script para extraer una muestra diversa de 100-120 clientes con notas clínicas ricas
(>300 caracteres) y generar ~200-240 pares cliente-candidato para análisis clínico profundo
con Antigravity/Gemini, sin depender de la lentitud de APIs externas.
"""

import asyncio
import json
import time
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.routers.matchmaking import find_candidate_matches_engine


async def extract_and_generate():
    print("================================================================")
    print("🚀 EXTRAYENDO MUESTRA RICA DE 100+ CLIENTES CON NOTAS CLÍNICAS")
    print("================================================================")

    async with AsyncSessionLocal() as db:
        # Selección balanceada por género, notas ricas y diversas ciudades
        # Hombres
        res_men = await db.execute(text("""
            SELECT u.id as user_id, u.name, p.city, p.gender, p.age, p.occupation,
                   p.responsable, LENGTH(p.bio_notes) as notes_len, p.bio_notes,
                   p.search_preferences, p.lifestyle, p.apego, p.love_language
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE LOWER(TRIM(p.gender)) IN ('hombre', 'masculino', 'm')
              AND LENGTH(COALESCE(p.bio_notes, '')) >= 300
              AND u.name IS NOT NULL
              AND u.name NOT ILIKE '%test%' AND u.name NOT ILIKE '%demo%'
            ORDER BY u.id DESC
            LIMIT 60
        """))
        men_rows = res_men.fetchall()

        # Mujeres
        res_women = await db.execute(text("""
            SELECT u.id as user_id, u.name, p.city, p.gender, p.age, p.occupation,
                   p.responsable, LENGTH(p.bio_notes) as notes_len, p.bio_notes,
                   p.search_preferences, p.lifestyle, p.apego, p.love_language
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE LOWER(TRIM(p.gender)) IN ('mujer', 'femenino', 'f')
              AND LENGTH(COALESCE(p.bio_notes, '')) >= 300
              AND u.name IS NOT NULL
              AND u.name NOT ILIKE '%test%' AND u.name NOT ILIKE '%demo%'
            ORDER BY u.id DESC
            LIMIT 60
        """))
        women_rows = res_women.fetchall()

        clients = list(men_rows) + list(women_rows)
        print(f"Total clientes seleccionados: {len(clients)} (Hombres: {len(men_rows)}, Mujeres: {len(women_rows)})")

        dataset_pairs = []
        safety_disqualified_total = 0
        t0 = time.time()

        for idx, row in enumerate(clients, start=1):
            uid = row.user_id
            name = row.name

            ext_res = await db.execute(text("SELECT * FROM client_extended_profile WHERE user_id = :uid"), {"uid": uid})
            ext_row = ext_res.fetchone()
            ext_data = dict(ext_row._mapping) if ext_row else {}

            client_summary = {
                "user_id": uid,
                "name": name,
                "city": row.city or "Bogotá",
                "gender": row.gender or "No especificado",
                "age": row.age,
                "occupation": row.occupation or "No especificada",
                "bio_notes": row.bio_notes or "",
                "search_preferences": row.search_preferences or {},
                "lifestyle": row.lifestyle or {},
                "apego": row.apego or {},
                "love_language": row.love_language or "No especificado",
                "responsable": row.responsable or "Equipo Clínico"
            }

            try:
                suggested, discarded, _ = await find_candidate_matches_engine(
                    client_summary=client_summary,
                    db=db,
                    pool_limit=80,
                    max_ai_evaluations=0,
                    nvidia_key=None,
                    return_discarded=True
                )

                safety_disq = [d for d in discarded if any("RED FLAG DE SEGURIDAD" in str(r) for r in d.get("reasons", []))]
                safety_disqualified_total += len(safety_disq)

                top_cands = suggested[:2]
                for c_idx, cand in enumerate(top_cands, start=1):
                    dataset_pairs.append({
                        "pair_id": f"PAIR-{idx:03d}-{c_idx}",
                        "client": {
                            "user_id": uid,
                            "name": name,
                            "city": client_summary["city"],
                            "gender": client_summary["gender"],
                            "age": client_summary["age"],
                            "occupation": client_summary["occupation"],
                            "psyc": client_summary["responsable"],
                            "notes_len": len(client_summary["bio_notes"]),
                            "notes": client_summary["bio_notes"],
                            "search_preferences": client_summary["search_preferences"],
                            "lifestyle": client_summary["lifestyle"],
                            "apego": client_summary["apego"],
                            "love_language": client_summary["love_language"]
                        },
                        "candidate": {
                            "user_id": cand.get("user_id"),
                            "name": cand.get("name"),
                            "city": cand.get("city"),
                            "gender": cand.get("gender"),
                            "age": cand.get("age"),
                            "occupation": cand.get("occupation"),
                            "notes_len": len(cand.get("bio_notes") or ""),
                            "notes": cand.get("bio_notes") or "",
                            "search_preferences": cand.get("search_preferences") or {},
                            "lifestyle": cand.get("lifestyle") or {},
                            "apego": cand.get("apego") or {},
                            "love_language": cand.get("love_language") or "No especificado"
                        },
                        "structural_score": cand.get("structural_score"),
                        "dealbreakers_clean": cand.get("dealbreakers_clean"),
                        "compatibility_breakdown": {
                            "points": cand.get("campos_evaluados_pts"),
                            "dealbreakers_check": cand.get("dealbreakers_check")
                        }
                    })

                if idx % 20 == 0 or idx == len(clients):
                    print(f"  Progreso: {idx}/{len(clients)} clientes procesados ({len(dataset_pairs)} pares)...")

            except Exception as e:
                print(f"  ⚠️ Error en cliente {name} (UID {uid}): {e}")

        elapsed = round(time.time() - t0, 2)
        print(f"\n✅ Extracción completada en {elapsed}s.")
        print(f"📊 Pares viables generados: {len(dataset_pairs)}")
        print(f"🚨 Candidatos descalificados por seguridad: {safety_disqualified_total}")

        out_path = "/app/batch_rich_200_pairs.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({
                "total_clients": len(clients),
                "total_pairs": len(dataset_pairs),
                "safety_disqualified_total": safety_disqualified_total,
                "pairs": dataset_pairs
            }, f, ensure_ascii=False, indent=2)

        print(f"📁 Guardado en {out_path}")

if __name__ == "__main__":
    asyncio.run(extract_and_generate())
