import asyncio
import json
import time
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer
from app.services.octagonal_match_evaluator import OctagonalMatchEvaluator

async def run_ronda6_audit():
    print("================================================================================")
    print("🔬 RONDA 6: AUDITORÍA MASIVA Y SINCERA DEL MOTOR OCTAGONAL (300 PAREJAS)")
    print("================================================================================\n")

    anchor_uids = [
        7841,   # Román Briceño (59a, Bogotá, Hombre, Senior Atleta, Vasectomía)
        12254,  # Juan Carlos Bermúdez (56a, Bogotá, Hombre, Senior Ecopetrol)
        12700,  # Nathalia Niño Moreno (51a, Bogotá, Mujer, Senior Fisioterapeuta)
        6251,   # María José Álvarez (22a, Bogotá, Mujer, Joven Estudiante)
        9706,   # Juan Pablo Rendón (24a, Medellín, Hombre, Joven Medellín)
        12945,  # Alejandra Chávez (30a, Cali, Mujer, Profesional Cali)
        13594,  # Sebastián Salazar (35a, Barranquilla, Hombre, Costa)
        9691,   # Diana Elizabeth Ocampo (37a, Bogotá, Mujer, Homosexual)
        12482,  # Javier Lemus (38a, Zipaquirá, Hombre, Turnos 30x21 Turquía, Vasectomía)
        13663   # Carlos David Castañeda (33a, Bogotá, Hombre, Notas ricas 6k chars)
    ]

    async with AsyncSessionLocal() as db:
        # Cargar los 10 anclas
        res_anchors = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.orientation, p.bio_notes, p.lifestyle, p.search_preferences, p.clinical_profile_360
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE p.user_id = ANY(:uids)
        """), {"uids": anchor_uids})
        anchors = {r.user_id: r for r in res_anchors.fetchall()}

        # Cargar un pool diverso de 80 candidatos reales de la BD
        res_cand = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.orientation, p.bio_notes, p.lifestyle, p.search_preferences, p.clinical_profile_360
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE LENGTH(COALESCE(p.bio_notes, '')) > 60
              AND u.name IS NOT NULL
              AND u.name NOT ILIKE '%test%'
            ORDER BY RANDOM()
            LIMIT 80;
        """))
        candidate_pool = res_cand.fetchall()

        all_results = []
        score_distribution = []
        verdict_counts = {}
        
        # Métricas para el análisis honesto
        age_gap_anomalies = []      # Parejas con >15 o >25 años de brecha y score > 80%
        city_mismatch_anomalies = [] # Parejas en ciudades distintas con score logística = 90%
        dealbreakers_caught = []
        frictions_caught = []
        default_score_count = 0     # Cuántas parejas tienen exactamente 88%

        total_evals = 0

        for aid in anchor_uids:
            a_row = anchors.get(aid)
            if not a_row:
                continue

            a_syn = a_row.clinical_profile_360
            if not a_syn or not isinstance(a_syn, dict) or "ejes" not in a_syn:
                a_syn = OctagonalPersonaSynthesizer.synthesize_profile(
                    a_row.user_id, a_row.name, a_row.city or "", a_row.gender or "", a_row.age,
                    a_row.bio_notes or "", a_row.lifestyle or {}, a_row.search_preferences or {}
                )

            is_homo = bool(a_row.orientation and ("homo" in a_row.orientation.lower() or "lesb" in a_row.orientation.lower()))

            evals_this_anchor = 0
            for k_row in candidate_pool:
                if k_row.user_id == aid:
                    continue

                # Filtro de género básico
                if not is_homo and a_row.gender and k_row.gender and a_row.gender == k_row.gender:
                    continue
                if is_homo and a_row.gender and k_row.gender and a_row.gender != k_row.gender:
                    continue

                if evals_this_anchor >= 30:
                    break

                k_syn = k_row.clinical_profile_360
                if not k_syn or not isinstance(k_syn, dict) or "ejes" not in k_syn:
                    k_syn = OctagonalPersonaSynthesizer.synthesize_profile(
                        k_row.user_id, k_row.name, k_row.city or "", k_row.gender or "", k_row.age,
                        k_row.bio_notes or "", k_row.lifestyle or {}, k_row.search_preferences or {}
                    )

                eval_res = OctagonalMatchEvaluator.evaluate_match(a_syn, k_syn)
                evals_this_anchor += 1
                total_evals += 1

                score = eval_res["score_global"]
                verdict = eval_res["veredicto"]
                score_distribution.append(score)
                verdict_counts[verdict] = verdict_counts.get(verdict, 0) + 1

                if score == 88:
                    default_score_count += 1

                # 1. Auditoría de Brecha de Edad
                age_a = a_row.age or 0
                age_k = k_row.age or 0
                age_diff = abs(age_a - age_k) if age_a and age_k else 0
                if age_diff >= 18 and score >= 80:
                    age_gap_anomalies.append({
                        "cliente": f"{a_row.name} ({age_a}a)",
                        "candidato": f"{k_row.name} ({age_k}a)",
                        "diff": age_diff,
                        "score": score,
                        "veredicto": verdict,
                        "eje_timing": eval_res["desglose_8_ejes"]["2_timing"]
                    })

                # 2. Auditoría de Ciudad / Logística
                city_a = (a_row.city or "").strip().lower()
                city_k = (k_row.city or "").strip().lower()
                if city_a and city_k and city_a != city_k and eval_res["desglose_8_ejes"]["1_logistica"] >= 85:
                    city_mismatch_anomalies.append({
                        "cliente": f"{a_row.name} ({a_row.city})",
                        "candidato": f"{k_row.name} ({k_row.city})",
                        "score_logistica": eval_res["desglose_8_ejes"]["1_logistica"],
                        "score_global": score
                    })

                # 3. Dealbreakers y Fricciones
                if eval_res.get("deal_breakers"):
                    dealbreakers_caught.append({
                        "pareja": f"{a_row.name} x {k_row.name}",
                        "score": score,
                        "db": eval_res["deal_breakers"]
                    })
                if eval_res.get("puntos_friccion"):
                    frictions_caught.extend(eval_res["puntos_friccion"])

                all_results.append({
                    "anchor_id": aid,
                    "anchor_name": a_row.name,
                    "anchor_age": a_row.age,
                    "anchor_city": a_row.city,
                    "cand_id": k_row.user_id,
                    "cand_name": k_row.name,
                    "cand_age": k_row.age,
                    "cand_city": k_row.city,
                    "score": score,
                    "veredicto": verdict,
                    "desglose": eval_res["desglose_8_ejes"],
                    "deal_breakers": eval_res.get("deal_breakers", []),
                    "puntos_friccion": eval_res.get("puntos_friccion", []),
                    "recomendacion": eval_res.get("recomendacion_psicologa", "")
                })

        # Estadísticas Honest
        avg_score = sum(score_distribution) / len(score_distribution) if score_distribution else 0
        min_score = min(score_distribution) if score_distribution else 0
        max_score = max(score_distribution) if score_distribution else 0

        print(f"Total evaluaciones ejecutadas: {total_evals}")
        print(f"Rango de scores: Min={min_score}%, Max={max_score}%, Promedio={avg_score:.1f}%")
        print("\nDistribución de Veredictos:")
        for v, cnt in verdict_counts.items():
            print(f"  {v}: {cnt} ({cnt/total_evals*100:.1f}%)")

        print(f"\n⚠️ FENÓMENO DE INFLACIÓN DE SCORE POR DEFECTO (88%):")
        print(f"  Parejas con score idéntico de 88%: {default_score_count} de {total_evals} ({default_score_count/total_evals*100:.1f}%)")

        print(f"\n🚨 ANOMALÍAS DE BRECHA DE EDAD (Diferencia ≥ 18 años con Score ≥ 80%): {len(age_gap_anomalies)}")
        for a in age_gap_anomalies[:8]:
            print(f"  • {a['cliente']} vs {a['candidato']} | Brecha: {a['diff']} años | Score: {a['score']}% (Eje Timing: {a['eje_timing']}%)")

        print(f"\n🚨 ANOMALÍAS DE DISTANCIA GEOGRÁFICA (Ciudades distintas con Logística ≥ 85%): {len(city_mismatch_anomalies)}")
        for c in city_mismatch_anomalies[:8]:
            print(f"  • {c['cliente']} vs {c['candidato']} | Logística: {c['score_logistica']}% | Score Global: {c['score_global']}%")

        print(f"\n🛑 DEALBREAKERS BLOQUEADOS: {len(dealbreakers_caught)}")
        for d in dealbreakers_caught[:6]:
            print(f"  • {d['pareja']} -> Score: {d['score']}% | Razón: {d['db']}")

        # Guardar en JSON
        with open("/app/ronda6_honest_audit.json", "w", encoding="utf-8") as f:
            json.dump({
                "total_evaluaciones": total_evals,
                "promedio_score": avg_score,
                "verdict_counts": verdict_counts,
                "default_score_count": default_score_count,
                "age_gap_anomalies": age_gap_anomalies,
                "city_mismatch_anomalies": city_mismatch_anomalies,
                "dealbreakers_caught": dealbreakers_caught,
                "all_evaluations": all_results
            }, f, indent=2, ensure_ascii=False)

if __name__ == '__main__':
    asyncio.run(run_ronda6_audit())
