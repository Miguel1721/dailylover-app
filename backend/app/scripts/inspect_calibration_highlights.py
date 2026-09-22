import json

def inspect():
    import os
    path = '/app/ronda6_calibracion_comparativa.json' if os.path.exists('/app/ronda6_calibracion_comparativa.json') else 'backend/ronda6_calibracion_comparativa.json'
    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    metrics = data['metrics']
    evals = data['evaluations']

    print("=" * 80)
    print("RESUMEN GENERAL DE LA CALIBRACIÓN (300 EVALUACIONES EMPÍRICAS)")
    print("=" * 80)
    print(f"Total Evaluaciones: {metrics['total']}")
    print(f"Score Promedio: {metrics['avg_before']:.1f}% -> {metrics['avg_after']:.1f}%")
    print("\nDistribución de Veredictos:")
    for v in sorted(metrics['after_verdicts'].keys()):
        b = metrics['before_verdicts'].get(v, 0)
        a = metrics['after_verdicts'].get(v, 0)
        print(f"  {v:26s} | Antes: {b:3d} ({b/3:.1f}%) | Ahora: {a:3d} ({a/3:.1f}%)")

    print("\n" + "=" * 80)
    print("CASO 1: ROMÁN BRICEÑO (59a, Bogotá, Senior Atleta Máster, Vasectomía)")
    print("=" * 80)
    roman_evals = [e for e in evals if e['anchor_id'] == 7841]
    for e in roman_evals[:10]:
        diff = e['age_diff']
        print(f"  vs {e['cand_name']:28s} ({e['cand_age']}a, {e['cand_city']}) | Gap: {diff:2d}a")
        print(f"     Score: {e['score_before']}% ({e['verdict_before']}) -> {e['score_after']}% ({e['verdict_after']})")
        if e['puntos_friccion']:
            print(f"     Fricción: {e['puntos_friccion'][0]}")
        if e['deal_breakers']:
            print(f"     Dealbreaker: {e['deal_breakers'][0]}")
        print()

    print("=" * 80)
    print("CASO 2: JUAN CARLOS BERMÚDEZ (56a, Bogotá, Senior Ecopetrol)")
    print("=" * 80)
    jc_evals = [e for e in evals if e['anchor_id'] == 12254]
    for e in jc_evals[:8]:
        diff = e['age_diff']
        print(f"  vs {e['cand_name']:28s} ({e['cand_age']}a, {e['cand_city']}) | Gap: {diff:2d}a")
        print(f"     Score: {e['score_before']}% ({e['verdict_before']}) -> {e['score_after']}% ({e['verdict_after']})")
        print(f"     Logística: {e['desglose_after']['1_logistica']}% | Timing: {e['desglose_after']['2_timing']}%")
        if e['puntos_friccion']:
            print(f"     Fricción: {e['puntos_friccion'][0]}")
        print()

    print("=" * 80)
    print("CASO 3: JAVIER LEMUS (38a, Zipaquirá, Turnos Turquía 30x21, Vasectomía)")
    print("=" * 80)
    javier_evals = [e for e in evals if e['anchor_id'] == 12482]
    for e in javier_evals[:6]:
        print(f"  vs {e['cand_name']:28s} ({e['cand_age']}a, {e['cand_city']})")
        print(f"     Score: {e['score_before']}% ({e['verdict_before']}) -> {e['score_after']}% ({e['verdict_after']})")
        print(f"     Logística: {e['desglose_after']['1_logistica']}% | Fricciones: {e['puntos_friccion'][:2]}")
        if e['deal_breakers']:
            print(f"     Dealbreaker: {e['deal_breakers'][0]}")
        print()

    print("=" * 80)
    print("CASO 4: DIANA ELIZABETH OCAMPO (37a, Bogotá, Homosexual)")
    print("=" * 80)
    diana_evals = [e for e in evals if e['anchor_id'] == 9691]
    print(f"Total evaluadas con Diana: {len(diana_evals)} mujeres")
    for e in diana_evals[:6]:
        print(f"  vs {e['cand_name']:28s} ({e['cand_age']}a, {e['cand_city']})")
        print(f"     Score: {e['score_before']}% ({e['verdict_before']}) -> {e['score_after']}% ({e['verdict_after']})")
        print(f"     Sinergias: {e['sinergias_fuertes'][:2]}")
        print()

    print("=" * 80)
    print("CASO 5: PAREJAS EN RECOMENDADO ALTO (LOS VERDADEROS 'UNICORNIOS' COMPATIBLES)")
    print("=" * 80)
    alto_evals = [e for e in evals if e['score_after'] >= 80]
    print(f"Total parejas que alcanzaron RECOMENDADO ALTO: {len(alto_evals)} de 300 ({len(alto_evals)/3:.1f}%)")
    for e in alto_evals[:8]:
        print(f"  • {e['anchor_name']} ({e['anchor_age']}a, {e['anchor_city']}) x {e['cand_name']} ({e['cand_age']}a, {e['cand_city']})")
        print(f"    Score Global: {e['score_after']}% | Brecha de Edad: {e['age_diff']} años")
        print(f"    Sinergias Fuertes: {e['sinergias_fuertes']}")
        print(f"    Guía de Cita: {e['recomendacion_psicologa']}")
        print()

if __name__ == '__main__':
    inspect()
