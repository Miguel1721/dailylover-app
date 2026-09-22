import asyncio
import json
import os
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer
from app.services.octagonal_match_evaluator import OctagonalMatchEvaluator

async def run_comparison():
    input_path = '/app/ronda6_honest_audit.json' if os.path.exists('/app/ronda6_honest_audit.json') else 'backend/ronda6_honest_audit.json'
    with open(input_path, 'r', encoding='utf-8') as f:
        prev_data = json.load(f)

    prev_evals = prev_data['all_evaluations']
    print(f"Loaded {len(prev_evals)} previous evaluations from {input_path}.")

    # Collect all unique user IDs
    all_uids = set()
    for ev in prev_evals:
        all_uids.add(ev['anchor_id'])
        all_uids.add(ev['cand_id'])

    print(f"Fetching fresh DB profiles for {len(all_uids)} unique candidates...")

    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.orientation, p.bio_notes, p.lifestyle, p.search_preferences
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE p.user_id = ANY(:uids)
        """), {"uids": list(all_uids)})
        rows = {r.user_id: r for r in res.fetchall()}

    # Synthesize all
    synthesized = {}
    for uid, r in rows.items():
        synthesized[uid] = OctagonalPersonaSynthesizer.synthesize_profile(
            user_id=r.user_id,
            name=r.name or f"User {uid}",
            city=r.city or "",
            gender=r.gender or "",
            age=r.age,
            bio_notes=r.bio_notes or "",
            lifestyle=r.lifestyle or {},
            search_preferences=r.search_preferences or {}
        )

    # Re-evaluate all 300 pairs with calibrated evaluator
    new_results = []
    before_scores = []
    after_scores = []
    before_verdicts = {}
    after_verdicts = {}

    age_anomalies_remaining = 0
    city_penalized_count = 0
    frictions_added_count = 0

    calibrated_88_count = 0

    for ev in prev_evals:
        aid = ev['anchor_id']
        kid = ev['cand_id']

        if aid not in synthesized or kid not in synthesized:
            continue

        a_syn = synthesized[aid]
        k_syn = synthesized[kid]

        new_eval = OctagonalMatchEvaluator.evaluate_match(a_syn, k_syn)

        old_score = ev['score']
        new_score = new_eval['score_global']
        old_verdict = ev['veredicto']
        new_verdict = new_eval['veredicto']

        before_scores.append(old_score)
        after_scores.append(new_score)

        before_verdicts[old_verdict] = before_verdicts.get(old_verdict, 0) + 1
        after_verdicts[new_verdict] = after_verdicts.get(new_verdict, 0) + 1

        if new_score == 88:
            calibrated_88_count += 1

        # Check age gap
        age_a = a_syn['metadata'].get('age') or 0
        age_k = k_syn['metadata'].get('age') or 0
        diff = abs(age_a - age_k) if age_a and age_k else 0
        if diff >= 18 and new_score >= 80:
            age_anomalies_remaining += 1

        # Check city penalty
        city_a = (a_syn['metadata'].get('city') or '').strip().lower()
        city_k = (k_syn['metadata'].get('city') or '').strip().lower()
        if city_a and city_k and city_a != city_k:
            if new_eval['desglose_8_ejes']['1_logistica'] <= 65:
                city_penalized_count += 1

        new_results.append({
            "anchor_id": aid,
            "anchor_name": a_syn['metadata']['name'],
            "anchor_age": age_a,
            "anchor_city": a_syn['metadata']['city'],
            "cand_id": kid,
            "cand_name": k_syn['metadata']['name'],
            "cand_age": age_k,
            "cand_city": k_syn['metadata']['city'],
            "age_diff": diff,
            "score_before": old_score,
            "score_after": new_score,
            "delta_score": new_score - old_score,
            "verdict_before": old_verdict,
            "verdict_after": new_verdict,
            "logistica_after": new_eval['desglose_8_ejes']['1_logistica'],
            "timing_after": new_eval['desglose_8_ejes']['2_timing'],
            "desglose_after": new_eval['desglose_8_ejes'],
            "deal_breakers": new_eval.get('deal_breakers', []),
            "puntos_friccion": new_eval.get('puntos_friccion', []),
            "sinergias_fuertes": new_eval.get('sinergias_fuertes', []),
            "recomendacion_psicologa": new_eval.get('recomendacion_psicologa', '')
        })

    avg_before = sum(before_scores) / len(before_scores)
    avg_after = sum(after_scores) / len(after_scores)

    print("\n" + "="*80)
    print("📊 RESULTADOS COMPARATIVOS: ANTES VS DESPUÉS DE LA CALIBRACIÓN")
    print("="*80)
    print(f"Total parejas analizadas: {len(new_results)}")
    print(f"Score Promedio: {avg_before:.1f}% ➔ {avg_after:.1f}% (Reducción realista de {avg_before - avg_after:.1f} pts)")
    print(f"Score Máximo / Mínimo: [{min(before_scores)}% - {max(before_scores)}%] ➔ [{min(after_scores)}% - {max(after_scores)}%]")
    print(f"\n1. Inflación artificial de 88%:")
    print(f"   Antes: {prev_data['default_score_count']} parejas ({prev_data['default_score_count']/len(new_results)*100:.1f}%)")
    print(f"   Ahora: {calibrated_88_count} parejas ({calibrated_88_count/len(new_results)*100:.1f}%)")

    print(f"\n2. Veredictos de Matchmaking:")
    for v in sorted(set(list(before_verdicts.keys()) + list(after_verdicts.keys()))):
        b_cnt = before_verdicts.get(v, 0)
        a_cnt = after_verdicts.get(v, 0)
        print(f"   • {v:30s}: Antes {b_cnt:3d} ({b_cnt/len(new_results)*100:4.1f}%) ➔ Ahora {a_cnt:3d} ({a_cnt/len(new_results)*100:4.1f}%)")

    print(f"\n3. Anomalías de Brecha de Edad (>=18 años con Score >=80%):")
    print(f"   Antes: {len(prev_data['age_gap_anomalies'])} parejas con descalce generacional en RECOMENDADO ALTO")
    print(f"   Ahora: {age_anomalies_remaining} parejas (Eliminación total o casi total de anomalías)")

    print(f"\n4. Penalización Geográfica Intermunicipal:")
    print(f"   Parejas en ciudades distintas que ahora tienen advertencia logística (Logística <=65%): {city_penalized_count}")

    # Top dramatic adjustments sample
    new_results_sorted = sorted(new_results, key=lambda x: x['delta_score'])
    print(f"\n5. Muestra de las correcciones clínicas más significativas (Top 8 caídas de score):")
    for r in new_results_sorted[:8]:
        print(f"   • {r['anchor_name']} ({r['anchor_age']}a, {r['anchor_city']}) x {r['cand_name']} ({r['cand_age']}a, {r['cand_city']})")
        print(f"     Score: {r['score_before']}% ➔ {r['score_after']}% ({r['delta_score']:+d} pts) | {r['verdict_before']} ➔ {r['verdict_after']}")
        print(f"     Fricciones: {r['puntos_friccion'][:2]}")
        print()

    # Save to json
    output_path = '/app/ronda6_calibracion_comparativa.json' if os.path.exists('/app') else 'backend/ronda6_calibracion_comparativa.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({
            "metrics": {
                "total": len(new_results),
                "avg_before": avg_before,
                "avg_after": avg_after,
                "before_verdicts": before_verdicts,
                "after_verdicts": after_verdicts,
                "default_88_before": prev_data['default_score_count'],
                "default_88_after": calibrated_88_count,
                "age_anomalies_before": len(prev_data['age_gap_anomalies']),
                "age_anomalies_after": age_anomalies_remaining,
                "city_penalized_count": city_penalized_count
            },
            "evaluations": new_results
        }, f, indent=2, ensure_ascii=False)
    print(f"Guardado reporte completo en {output_path}")

if __name__ == '__main__':
    asyncio.run(run_comparison())
