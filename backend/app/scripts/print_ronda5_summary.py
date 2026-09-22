import json

def summarize():
    import os
    path = '/app/ronda5_full_120_evaluations.json' if os.path.exists('/app/ronda5_full_120_evaluations.json') else 'backend/ronda5_full_120_evaluations.json'
    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    print(f"Total clientes evaluados: {len(data['clientes'])}")
    print(f"Total evaluaciones: {data['total_evaluaciones']}")
    print(f"Veredictos: {data['verdict_counts']}")
    print(f"Fricciones: {data['total_fricciones']}")
    print(f"Dealbreakers: {data['total_dealbreakers']}\n")

    for c in data['clientes']:
        print("================================================================================")
        print(f"CLIENTE ANCLA: {c['cliente_nombre']} (UID {c['cliente_id']} | {c['cliente_edad']} años | {c['cliente_ciudad']} | {c['cliente_genero']})")
        print(f"Perfil: Logística={c['perfil_resumen']['logistica']} | Hijos={c['perfil_resumen']['hijos']} | Vasectomía={c['perfil_resumen']['vasectomia']} | Conflicto={c['perfil_resumen']['conflicto']}")
        print("--------------------------------------------------------------------------------")
        for idx, ev in enumerate(c['evaluaciones']):
            db_tag = f" 🛑 DEALBREAKER: {ev['deal_breakers']}" if ev['deal_breakers'] else ""
            fr_tag = f" ⚠️ FRICCIONES ({len(ev['puntos_friccion'])}): {ev['puntos_friccion']}" if ev['puntos_friccion'] else ""
            sin_tag = f" ✨ SINERGIAS: {ev['sinergias_fuertes']}" if ev['sinergias_fuertes'] else ""
            
            print(f"  #{idx+1:02d} [{ev['veredicto']}] Score: {ev['score_global']}% -> {ev['candidato_nombre']} (UID {ev['candidato_id']}, {ev['candidato_edad']}a, {ev['candidato_ciudad']})")
            if db_tag:
                print(f"     {db_tag}")
            if fr_tag:
                print(f"     {fr_tag}")
            if sin_tag:
                print(f"     {sin_tag}")
            print(f"     Ejes: {ev['desglose_8_ejes']}")
            print(f"     Consejo: {ev['recomendacion_psicologa']}\n")

if __name__ == '__main__':
    summarize()
