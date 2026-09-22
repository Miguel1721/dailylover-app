import json

def analyze():
    import os
    path = '/app/ronda6_honest_audit.json' if os.path.exists('/app/ronda6_honest_audit.json') else 'backend/ronda6_honest_audit.json'
    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    print(f"Total Evaluaciones: {data['total_evaluaciones']}")
    print(f"Promedio de Score: {data['promedio_score']:.1f}%")
    print(f"Distribución de Veredictos: {data['verdict_counts']}")
    print(f"Score idéntico a 88%: {data['default_score_count']} ({data['default_score_count']/data['total_evaluaciones']*100:.1f}%)")
    print(f"Anomalías de Brecha de Edad (>=18 años con Score >=80%): {len(data['age_gap_anomalies'])}")
    print(f"Anomalías de Ciudad Distinta (con Logística >=85%): {len(data['city_mismatch_anomalies'])}")
    print(f"Dealbreakers bloqueados: {len(data['dealbreakers_caught'])}")

    print("\n--- MUESTRA DE ANOMALÍAS DE EDAD ---")
    for a in data['age_gap_anomalies'][:6]:
        print(f"  {a['cliente']} vs {a['candidato']} -> Brecha {a['diff']} años, Score {a['score']}%, Eje Timing {a['eje_timing']}%")

    print("\n--- MUESTRA DE ANOMALÍAS DE CIUDAD ---")
    for c in data['city_mismatch_anomalies'][:6]:
        print(f"  {c['cliente']} vs {c['candidato']} -> Logística {c['score_logistica']}%, Score Global {c['score_global']}%")

    print("\n--- MUESTRA DE DEALBREAKERS ---")
    for d in data['dealbreakers_caught'][:6]:
        print(f"  {d['pareja']} -> {d['db']}")

if __name__ == '__main__':
    analyze()
