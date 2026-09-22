import asyncio
import json
import time
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer
from app.services.octagonal_match_evaluator import OctagonalMatchEvaluator

async def run_ronda7_stress_test():
    print("=" * 80)
    print("🚀 RONDA 7: MEGA ESTRÉS EMPÍRICO — 20 ANCLAS DIVERSAS Y 500 EVALUACIONES REALES")
    print("=" * 80)

    async with AsyncSessionLocal() as db:
        # Seleccionar 20 anclas totalmente nuevas con notas extensas (>300 caracteres)
        # Cubriendo distintas edades, géneros y ciudades
        res = await db.execute(text("""
            WITH ranked AS (
                SELECT p.user_id, u.name, p.city, p.gender, p.age, p.orientation, p.bio_notes, p.lifestyle, p.search_preferences,
                       ROW_NUMBER() OVER(PARTITION BY p.city, p.gender ORDER BY LENGTH(p.bio_notes) DESC) as rn
                FROM profiles p
                JOIN users u ON u.id = p.user_id
                WHERE LENGTH(COALESCE(p.bio_notes, '')) > 300
                  AND p.user_id NOT IN (7841, 12254, 12700, 6251, 9706, 12945, 13594, 9691, 12482, 13663)
                  AND p.age IS NOT NULL AND p.age > 18
                  AND u.name IS NOT NULL
                  AND u.name NOT ILIKE '%test%'
                  AND p.city IS NOT NULL
            )
            SELECT user_id, name, city, gender, age, orientation, bio_notes, lifestyle, search_preferences
            FROM ranked
            WHERE rn <= 3
            ORDER BY RANDOM()
            LIMIT 20;
        """))
        anchors = res.fetchall()

        print(f"\n📋 20 NUEVAS PERSONAS ANCLA SELECCIONADAS:")
        for idx, a in enumerate(anchors, 1):
            city_clean = (a.city or '').strip()
            print(f"  {idx:2d}. {a.name:30s} | {a.age}a | {a.gender:7s} | {city_clean:15s} | Notas: {len(a.bio_notes or '')} chars")

        # Cargar un gran pool de candidatos reales (150 candidatos diversos)
        res_cand = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.orientation, p.bio_notes, p.lifestyle, p.search_preferences
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE LENGTH(COALESCE(p.bio_notes, '')) > 60
              AND u.name IS NOT NULL
              AND u.name NOT ILIKE '%test%'
              AND p.age IS NOT NULL
            ORDER BY RANDOM()
            LIMIT 150;
        """))
        candidate_pool = res_cand.fetchall()
        print(f"\n📦 Pool de candidatos cargado: {len(candidate_pool)} perfiles reales.")

        # Sintetizar perfiles
        print("\n⚙️ Sintetizando personas en 8 Ejes...")
        t0 = time.time()
        syn_anchors = {}
        for a in anchors:
            syn_anchors[a.user_id] = OctagonalPersonaSynthesizer.synthesize_profile(
                a.user_id, a.name, a.city or "", a.gender or "", a.age,
                a.bio_notes or "", a.lifestyle or {}, a.search_preferences or {}
            )

        syn_candidates = {}
        for c in candidate_pool:
            syn_candidates[c.user_id] = OctagonalPersonaSynthesizer.synthesize_profile(
                c.user_id, c.name, c.city or "", c.gender or "", c.age,
                c.bio_notes or "", c.lifestyle or {}, c.search_preferences or {}
            )
        t_synth = time.time() - t0
        print(f"✅ {len(syn_anchors) + len(syn_candidates)} perfiles sintetizados en {t_synth:.3f} segundos.")

        # Ejecutar 500 evaluaciones cruzadas
        print("\n🧠 Evaluando 500 parejas con el Motor Calibrado...")
        t_eval0 = time.time()
        evaluations = []
        scores = []
        verdicts = {}
        dealbreakers_total = 0
        frictions_total = 0
        synergies_total = 0

        # Anomalías a vigilar con lupa
        age_anomalies = []       # Brecha >= 18a con Score >= 80%
        city_anomalies = []      # Distintas ciudades con Logística >= 85%
        extreme_gap_anomalies = [] # Brecha >= 25a con Score > 64%

        eval_count = 0
        target_evals_per_anchor = 25  # 20 anclas * 25 candidatos = 500 evaluaciones

        for a in anchors:
            a_syn = syn_anchors[a.user_id]
            is_homo = bool(a.orientation and ("homo" in a.orientation.lower() or "lesb" in a.orientation.lower()))
            evals_for_a = 0

            for c in candidate_pool:
                if c.user_id == a.user_id:
                    continue

                # Filtro de orientación básica
                if not is_homo and a.gender and c.gender and a.gender == c.gender:
                    continue
                if is_homo and a.gender and c.gender and a.gender != c.gender:
                    continue

                if evals_for_a >= target_evals_per_anchor:
                    break

                c_syn = syn_candidates[c.user_id]
                res_match = OctagonalMatchEvaluator.evaluate_match(a_syn, c_syn)
                eval_count += 1
                evals_for_a += 1

                score = res_match["score_global"]
                verdict = res_match["veredicto"]
                scores.append(score)
                verdicts[verdict] = verdicts.get(verdict, 0) + 1

                dbs = res_match.get("deal_breakers", [])
                frics = res_match.get("puntos_friccion", [])
                syns = res_match.get("sinergias_fuertes", [])

                dealbreakers_total += len(dbs)
                frictions_total += len(frics)
                synergies_total += len(syns)

                # Auditoría rigurosa
                age_a = a.age or 0
                age_c = c.age or 0
                diff = abs(age_a - age_c)

                if diff >= 18 and score >= 80:
                    age_anomalies.append({
                        "a": f"{a.name} ({age_a}a)",
                        "c": f"{c.name} ({age_c}a)",
                        "diff": diff,
                        "score": score
                    })

                if diff >= 25 and score > 64:
                    extreme_gap_anomalies.append({
                        "a": f"{a.name} ({age_a}a)",
                        "c": f"{c.name} ({age_c}a)",
                        "diff": diff,
                        "score": score
                    })

                city_a = (a.city or "").strip().lower()
                city_c = (c.city or "").strip().lower()
                if city_a and city_c and city_a != city_c:
                    if res_match["desglose_8_ejes"]["1_logistica"] >= 85:
                        city_anomalies.append({
                            "a": f"{a.name} ({a.city})",
                            "c": f"{c.name} ({c.city})",
                            "score_log": res_match["desglose_8_ejes"]["1_logistica"]
                        })

                evaluations.append({
                    "anchor_id": a.user_id,
                    "anchor_name": a.name,
                    "anchor_age": age_a,
                    "anchor_city": a.city,
                    "cand_id": c.user_id,
                    "cand_name": c.name,
                    "cand_age": age_c,
                    "cand_city": c.city,
                    "age_diff": diff,
                    "score": score,
                    "veredicto": verdict,
                    "desglose": res_match["desglose_8_ejes"],
                    "deal_breakers": dbs,
                    "puntos_friccion": frics,
                    "sinergias_fuertes": syns,
                    "recomendacion_psicologa": res_match.get("recomendacion_psicologa", "")
                })

        t_eval = time.time() - t_eval0
        rate = eval_count / t_eval if t_eval > 0 else 0
        avg_score = sum(scores) / len(scores) if scores else 0

        print(f"\n⚡ {eval_count} evaluaciones ejecutadas en {t_eval:.2f} segundos (~{rate:.0f} parejas/segundo).")
        print("\n" + "=" * 80)
        print("📊 AUDITORÍA HONESTA DE LA DISTRIBUCIÓN ESTADÍSTICA (500 PAREJAS)")
        print("=" * 80)
        print(f"Rango de Scores: Min={min(scores)}%, Max={max(scores)}%, Promedio={avg_score:.1f}%")
        print(f"\nDistribución de Veredictos:")
        for v in sorted(verdicts.keys()):
            cnt = verdicts[v]
            pct = cnt / eval_count * 100
            bar = "█" * int(pct // 2)
            print(f"  {v:26s} : {cnt:3d} ({pct:5.1f}%) | {bar}")

        print(f"\n🔍 MÉTRICAS DE DIAGNÓSTICO CLÍNICO:")
        print(f"  • Dealbreakers Bloqueantes Detenidos : {dealbreakers_total}")
        print(f"  • Puntos de Fricción Diagnosticados  : {frictions_total} (Promedio: {frictions_total/eval_count:.1f} por pareja)")
        print(f"  • Sinergias Positivas Identificadas  : {synergies_total} (Promedio: {synergies_total/eval_count:.1f} por pareja)")
        print(f"  • Parejas con Score Idéntico de 88%  : {scores.count(88)} de {eval_count} ({scores.count(88)/eval_count*100:.1f}%)")

        print(f"\n🚨 CONTROL DE INTEGRIDAD — ANOMALÍAS ENCONTRADAS:")
        print(f"  • Brechas de edad (>=18a) con Score >= 80% (Infladas): {len(age_anomalies)}")
        print(f"  • Brechas extremas (>=25a) con Score > 64% (Sin techo): {len(extreme_gap_anomalies)}")
        print(f"  • Parejas en ciudades distintas con Logística >= 85%  : {len(city_anomalies)}")

        print("\n" + "=" * 80)
        print("🌟 TOP 5 MEJORES MATCHES DESCUBIERTOS (ALTA COMPATIBILIDAD REAL)")
        print("=" * 80)
        top_matches = sorted(evaluations, key=lambda x: x['score'], reverse=True)[:5]
        for m in top_matches:
            print(f"  ❤️ {m['anchor_name']} ({m['anchor_age']}a, {m['anchor_city']}) x {m['cand_name']} ({m['cand_age']}a, {m['cand_city']})")
            print(f"     Score: {m['score']}% | Veredicto: {m['veredicto']} | Brecha: {m['age_diff']} años")
            print(f"     Sinergias: {m['sinergias_fuertes']}")
            print(f"     Guía de Cita: {m['recomendacion_psicologa']}")
            print()

        print("=" * 80)
        print("🛑 TOP 5 MATCHES CON MAYOR INCOMPATIBILIDAD DETECTADA")
        print("=" * 80)
        worst_matches = sorted(evaluations, key=lambda x: x['score'])[:5]
        for m in worst_matches:
            print(f"  🚫 {m['anchor_name']} ({m['anchor_age']}a, {m['anchor_city']}) x {m['cand_name']} ({m['cand_age']}a, {m['cand_city']})")
            print(f"     Score: {m['score']}% | Veredicto: {m['veredicto']}")
            if m['deal_breakers']:
                print(f"     Dealbreaker: {m['deal_breakers'][0]}")
            if m['puntos_friccion']:
                print(f"     Fricción: {m['puntos_friccion'][0]}")
            print(f"     Acción: {m['recomendacion_psicologa']}")
            print()

        # Guardar en JSON para análisis
        out_file = "/app/ronda7_mega_estres_500.json" if os.path.exists("/app") else "backend/ronda7_mega_estres_500.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump({
                "meta": {
                    "total_evaluaciones": eval_count,
                    "promedio_score": avg_score,
                    "min_score": min(scores),
                    "max_score": max(scores),
                    "verdicts": verdicts,
                    "dealbreakers_total": dealbreakers_total,
                    "frictions_total": frictions_total,
                    "synergies_total": synergies_total,
                    "age_anomalies": len(age_anomalies),
                    "extreme_gap_anomalies": len(extreme_gap_anomalies),
                    "city_anomalies": len(city_anomalies)
                },
                "anchors": [
                    {"id": a.user_id, "name": a.name, "age": a.age, "city": a.city, "gender": a.gender}
                    for a in anchors
                ],
                "evaluations": evaluations
            }, f, indent=2, ensure_ascii=False)
        print(f"Archivo guardado exitosamente en: {out_file}")

if __name__ == '__main__':
    import os
    asyncio.run(run_ronda7_stress_test())
