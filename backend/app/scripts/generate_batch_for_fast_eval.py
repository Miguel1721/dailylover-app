"""
Script para generar el dataset de 57 clientes y sus Top 2 candidatos viables
(114 pares cliente-candidato en total) procesados por el motor Tier 1 (con las 6 reglas duras).
Exporta los datos completos (notas clínicas, datos demográficos, prompt payload)
para evaluación rápida y rigurosa de calidad de prompts y detección de patrones genéricos.
"""

import asyncio
import json
import time
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.routers.matchmaking import find_candidate_matches_engine


async def generate_batch():
    with open("/app/sample_60_clients.json", "r", encoding="utf-8") as f:
        clients_meta = json.load(f)

    print(f"Procesando {len(clients_meta)} clientes en Tier 1...")
    t0 = time.time()

    dataset_pairs = []
    safety_disqualified_total = 0

    async with AsyncSessionLocal() as db:
        for idx, cm in enumerate(clients_meta):
            uid = cm["user_id"]
            ident = cm["name"]
            try:

                prof_res = await db.execute(text("""
                    SELECT p.gender, p.city, p.age, p.plan_tier, p.occupation, p.orientation, p.responsable,
                           p.love_language, p.apego, p.estatura, p.search_preferences, p.bio_notes, p.lifestyle
                    FROM profiles p WHERE p.user_id = :uid LIMIT 1
                """), {"uid": uid})
                prof_row = prof_res.fetchone()

                ext_res = await db.execute(text("SELECT * FROM client_extended_profile WHERE user_id = :uid"), {"uid": uid})
                ext_row = ext_res.fetchone()
                ext_data = dict(ext_row._mapping) if ext_row else {}

                client_summary = {
                    "user_id": uid,
                    "name": cm["name"],
                    "city": prof_row.city if prof_row and prof_row.city else cm.get("city"),
                    "gender": prof_row.gender if prof_row and prof_row.gender else "Hombre",
                    "age": prof_row.age if prof_row and prof_row.age else cm.get("age"),
                    "occupation": prof_row.occupation if prof_row else "No especificada",
                    "bio_notes": prof_row.bio_notes if prof_row and prof_row.bio_notes else "",
                    "search_preferences": prof_row.search_preferences if prof_row and prof_row.search_preferences else {},
                    "lifestyle": prof_row.lifestyle if prof_row and prof_row.lifestyle else {},
                    "apego": prof_row.apego if prof_row and prof_row.apego else {}
                }

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

                top_2 = suggested[:2]
                for cand_idx, cand in enumerate(top_2):
                    dataset_pairs.append({
                        "pair_id": f"PAIR-{idx+1:02d}-{cand_idx+1}",
                        "client_name": client_summary.get("name"),
                        "client_city": client_summary.get("city"),
                        "client_age": client_summary.get("age"),
                        "client_occupation": client_summary.get("occupation"),
                        "client_notes": client_summary.get("bio_notes") or "",
                        "client_notes_length": len(client_summary.get("bio_notes") or ""),
                        "candidate_name": cand.get("name"),
                        "candidate_city": cand.get("city"),
                        "candidate_age": cand.get("age"),
                        "candidate_occupation": cand.get("occupation"),
                        "candidate_notes": cand.get("bio_notes") or "",
                        "candidate_notes_length": len(cand.get("bio_notes") or ""),
                        "structural_score": cand.get("structural_score"),
                        "psyc": cm.get("psyc")
                    })

                if (idx + 1) % 15 == 0 or idx == len(clients_meta) - 1:
                    print(f"  Progreso: {idx+1}/{len(clients_meta)} clientes procesados...")

            except Exception as e:
                print(f"  ⚠️ Error en cliente '{ident}': {e}")

    elapsed = round(time.time() - t0, 2)
    print(f"\n✅ Procesamiento Tier 1 completado en {elapsed}s.")
    print(f"📊 Total de pares generados para auditoría: {len(dataset_pairs)}")
    print(f"🚨 Total descalificados por Red Flags de Seguridad en la muestra: {safety_disqualified_total}")

    output_path = "/app/batch_eval_dataset_100.json"
    with open(output_path, "w", encoding="utf-8") as out:
        json.dump({
            "total_clients": len(clients_meta),
            "total_pairs": len(dataset_pairs),
            "safety_disqualified_count": safety_disqualified_total,
            "pairs": dataset_pairs
        }, out, ensure_ascii=False, indent=2)

    print(f"📁 Dataset guardado en {output_path}")


if __name__ == "__main__":
    asyncio.run(generate_batch())
