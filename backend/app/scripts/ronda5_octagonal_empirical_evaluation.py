"""
Ronda 5: Evaluación Empírica del Motor Octagonal (8 Ejes) vs Casos Reales de la BD
Compara el diagnóstico clínico multidimensional contra perfiles reales de DailyLover.
"""

import asyncio
import json
import time
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer
from app.services.octagonal_match_evaluator import OctagonalMatchEvaluator

async def run_ronda5_evaluation():
    print("=====================================================================")
    print("🔬 RONDA 5: EVALUACIÓN EMPÍRICA EN PROFUNDIDAD CON MOTOR OCTAGONAL (8 EJES)")
    print("=====================================================================\n")

    start_time = time.time()
    
    # Target diverse clients from real DB representing varied archetypes:
    # 1. Román Briceño (7841 - Atleta 59a, vasectomía)
    # 2. Natalia Rodríguez (9568 - 31a, tiempo fuera en conflicto, independiente)
    # 3. Javier Lemus (12482 - 38a, rotación 30x21 Turquía)
    # 4. Andrea Rojas (7502 - 37a, custodia compartida semana de por medio)
    # 5. Marco Ruiz (12727 - 57a, $40M COP, socio Mustang, no izquierda)
    # 6. Camila Motta (12756 - 28a, médica VIP, busca mujeres)
    
    clients_to_test = [7841, 9568, 12482, 7502, 12727, 12756]
    
    async with AsyncSessionLocal() as db:
        # Load clients
        res_clients = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.bio_notes, p.lifestyle, p.search_preferences, p.clinical_profile_360
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE p.user_id = ANY(:uids)
        """), {"uids": clients_to_test})
        clients = {r.user_id: r for r in res_clients.fetchall()}
        
        # Load potential candidates from opposite gender (or same for homosexual) in same city cluster
        res_candidates = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.bio_notes, p.lifestyle, p.search_preferences, p.clinical_profile_360
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE LENGTH(COALESCE(p.bio_notes, '')) > 60
              AND u.name IS NOT NULL
              AND u.name NOT ILIKE '%test%'
            ORDER BY RANDOM()
            LIMIT 40;
        """))
        candidates = res_candidates.fetchall()

        total_evaluations = 0
        verdicts_count = {"RECOMENDADO ALTO": 0, "RECOMENDADO MODERADO": 0, "VIABLE CON RESERVAS": 0, "NO RECOMENDADO": 0, "NO RECOMENDADO (BLOQUEADO)": 0}
        frictions_detected = 0
        dealbreakers_detected = 0

        detailed_cases = []

        for cid, c_row in clients.items():
            # Get synthesized client
            c_syn = c_row.clinical_profile_360
            if not c_syn or not isinstance(c_syn, dict) or "ejes" not in c_syn:
                c_syn = OctagonalPersonaSynthesizer.synthesize_profile(
                    c_row.user_id, c_row.name, c_row.city or "", c_row.gender or "", c_row.age,
                    c_row.bio_notes or "", c_row.lifestyle or {}, c_row.search_preferences or {}
                )
                
            print(f"\n================================================================================")
            print(f"🎯 CLIENTE ANCLA: {c_syn['metadata']['name']} (UID {c_syn['metadata']['user_id']}, {c_syn['metadata']['age']}a, {c_syn['metadata']['city']}, {c_syn['metadata']['gender']})")
            print(f"   Logística: {c_syn['ejes']['1_logistica']['disponibilidad_resumen']}")
            print(f"   Axiología: Hijos={c_syn['ejes']['3_axiologia']['tiene_hijos']}, Vasectomía={c_syn['ejes']['3_axiologia']['vasectomia']}, Finanzas={c_syn['ejes']['3_axiologia']['modelo_financiero']}")
            print(f"   Ritmo Vital: {c_syn['ejes']['6_ritmo_vital']['vitalidad_fisica']} | Conflicto: {c_syn['ejes']['4_conflicto']['estilo_procesamiento']}")
            print(f"================================================================================")

            client_matches = []
            for k_row in candidates:
                if k_row.user_id == cid:
                    continue
                # Simple gender check: if client is straight, filter opposite gender
                if cid != 12756 and c_row.gender and k_row.gender and c_row.gender == k_row.gender:
                    continue
                if cid == 12756 and k_row.gender != "Mujer":
                    continue

                k_syn = k_row.clinical_profile_360
                if not k_syn or not isinstance(k_syn, dict) or "ejes" not in k_syn:
                    k_syn = OctagonalPersonaSynthesizer.synthesize_profile(
                        k_row.user_id, k_row.name, k_row.city or "", k_row.gender or "", k_row.age,
                        k_row.bio_notes or "", k_row.lifestyle or {}, k_row.search_preferences or {}
                    )

                eval_res = OctagonalMatchEvaluator.evaluate_match(c_syn, k_syn)
                total_evaluations += 1
                verdict = eval_res["veredicto"]
                verdicts_count[verdict] = verdicts_count.get(verdict, 0) + 1
                
                if eval_res.get("puntos_friccion"):
                    frictions_detected += len(eval_res["puntos_friccion"])
                if eval_res.get("deal_breakers"):
                    dealbreakers_detected += len(eval_res["deal_breakers"])

                client_matches.append(eval_res)

            # Sort matches by score
            client_matches.sort(key=lambda x: x["score_global"], reverse=True)
            top_match = client_matches[0] if client_matches else None
            worst_match = client_matches[-1] if client_matches else None

            if top_match:
                print(f"\n  🥇 TOP MATCH PARA {c_syn['metadata']['name']}:")
                print(f"     Candidato: {top_match['candidato']} | Score: {top_match['score_global']}% | Veredicto: {top_match['veredicto']}")
                print(f"     📊 Ejes: {top_match['desglose_8_ejes']}")
                if top_match['sinergias_fuertes']:
                    print(f"     ✨ Sinergias: {top_match['sinergias_fuertes']}")
                if top_match['puntos_friccion']:
                    print(f"     ⚠️ Fricciones: {top_match['puntos_friccion']}")
                print(f"     💡 Guía Psicóloga: {top_match['recomendacion_psicologa']}")

            if worst_match and worst_match['score_global'] < 50:
                print(f"\n  🛑 CASO INCOMPATIBLE DETECTADO AUTOMÁTICAMENTE (EVITÓ CITA FALLIDA):")
                print(f"     Candidato: {worst_match['candidato']} | Score: {worst_match['score_global']}% | Veredicto: {worst_match['veredicto']}")
                if worst_match['deal_breakers']:
                    print(f"     🛑 Dealbreakers Bloqueantes: {worst_match['deal_breakers']}")
                if worst_match['puntos_friccion']:
                    print(f"     ⚠️ Fricciones: {worst_match['puntos_friccion']}")
                print(f"     💡 Guía Psicóloga: {worst_match['recomendacion_psicologa']}")

        elapsed = time.time() - start_time
        print(f"\n================================================================================")
        print(f"📊 BALANCE ESTADÍSTICO DE RONDA 5:")
        print(f"  • Total evaluaciones cruzadas en 8 ejes: {total_evaluations}")
        print(f"  • Tiempo total: {elapsed:.2f}s ({total_evaluations/elapsed:.1f} parejas evaluadas/seg)")
        print(f"  • Distribución de Veredictos Clínicos:")
        for v, count in verdicts_count.items():
            print(f"    - {v}: {count} ({count/max(1, total_evaluations)*100:.1f}%)")
        print(f"  • Puntos de fricción preventiva diagnosticados: {frictions_detected}")
        print(f"  • Incompatibilidades insalvables (Dealbreakers) bloqueadas: {dealbreakers_detected}")
        print(f"================================================================================\n")

if __name__ == '__main__':
    asyncio.run(run_ronda5_evaluation())
