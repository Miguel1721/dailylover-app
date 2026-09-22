import asyncio
import json
import time
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer
from app.services.octagonal_match_evaluator import OctagonalMatchEvaluator

async def generate_detailed_report():
    print("=====================================================================")
    print("🔬 GENERANDO REPORTE COMPLETO DETALLADO DE RONDA 5 (120 PAREJAS)")
    print("=====================================================================\n")

    clients_to_test = [7841, 9568, 12482, 7502, 12727, 12756]

    async with AsyncSessionLocal() as db:
        # 1. Cargar clientes ancla
        res_clients = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.bio_notes, p.lifestyle, p.search_preferences, p.clinical_profile_360
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE p.user_id = ANY(:uids)
        """), {"uids": clients_to_test})
        clients = {r.user_id: r for r in res_clients.fetchall()}

        # 2. Cargar pool diverso de candidatos reales de la BD
        res_candidates = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.bio_notes, p.lifestyle, p.search_preferences, p.clinical_profile_360
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE LENGTH(COALESCE(p.bio_notes, '')) > 60
              AND u.name IS NOT NULL
              AND u.name NOT ILIKE '%test%'
            ORDER BY p.user_id ASC
            LIMIT 60;
        """))
        candidates = res_candidates.fetchall()

        all_reports = []
        summary_stats = {
            "total_evaluaciones": 0,
            "verdict_counts": {},
            "total_dealbreakers": 0,
            "total_fricciones": 0,
            "clientes": []
        }

        for cid in clients_to_test:
            c_row = clients.get(cid)
            if not c_row:
                continue

            c_syn = c_row.clinical_profile_360
            if not c_syn or not isinstance(c_syn, dict) or "ejes" not in c_syn:
                c_syn = OctagonalPersonaSynthesizer.synthesize_profile(
                    c_row.user_id, c_row.name, c_row.city or "", c_row.gender or "", c_row.age,
                    c_row.bio_notes or "", c_row.lifestyle or {}, c_row.search_preferences or {}
                )

            client_report = {
                "cliente_id": cid,
                "cliente_nombre": c_row.name,
                "cliente_edad": c_row.age,
                "cliente_genero": c_row.gender,
                "cliente_ciudad": c_row.city,
                "perfil_resumen": {
                    "logistica": c_syn["ejes"]["1_logistica"]["disponibilidad_resumen"],
                    "timing": c_syn["ejes"]["2_timing"]["intencion_primaria"],
                    "hijos": c_syn["ejes"]["3_axiologia"]["tiene_hijos"],
                    "vasectomia": c_syn["ejes"]["3_axiologia"]["vasectomia"],
                    "finanzas": c_syn["ejes"]["3_axiologia"]["modelo_financiero"],
                    "conflicto": c_syn["ejes"]["4_conflicto"]["estilo_procesamiento"],
                    "autonomia": c_syn["ejes"]["5_autonomia"]["necesidad_espacio_personal"],
                    "ritmo_vital": c_syn["ejes"]["6_ritmo_vital"]["vitalidad_fisica"],
                    "polaridad": c_syn["ejes"]["7_polaridad"]["dinamica_preferida"]
                },
                "evaluaciones": []
            }

            eval_count_client = 0
            for k_row in candidates:
                if k_row.user_id == cid:
                    continue
                # Filtro de orientación básica
                if cid != 12756 and c_row.gender and k_row.gender and c_row.gender == k_row.gender:
                    continue
                if cid == 12756 and k_row.gender != "Mujer":
                    continue

                if eval_count_client >= 20:
                    break

                k_syn = k_row.clinical_profile_360
                if not k_syn or not isinstance(k_syn, dict) or "ejes" not in k_syn:
                    k_syn = OctagonalPersonaSynthesizer.synthesize_profile(
                        k_row.user_id, k_row.name, k_row.city or "", k_row.gender or "", k_row.age,
                        k_row.bio_notes or "", k_row.lifestyle or {}, k_row.search_preferences or {}
                    )

                eval_res = OctagonalMatchEvaluator.evaluate_match(c_syn, k_syn)
                eval_count_client += 1
                summary_stats["total_evaluaciones"] += 1
                
                v = eval_res["veredicto"]
                summary_stats["verdict_counts"][v] = summary_stats["verdict_counts"].get(v, 0) + 1
                summary_stats["total_fricciones"] += len(eval_res.get("puntos_friccion", []))
                summary_stats["total_dealbreakers"] += len(eval_res.get("deal_breakers", []))

                cand_entry = {
                    "candidato_id": k_row.user_id,
                    "candidato_nombre": k_row.name,
                    "candidato_edad": k_row.age,
                    "candidato_ciudad": k_row.city,
                    "candidato_genero": k_row.gender,
                    "score_global": eval_res["score_global"],
                    "veredicto": eval_res["veredicto"],
                    "desglose_8_ejes": eval_res["desglose_8_ejes"],
                    "sinergias_fuertes": eval_res.get("sinergias_fuertes", []),
                    "puntos_friccion": eval_res.get("puntos_friccion", []),
                    "deal_breakers": eval_res.get("deal_breakers", []),
                    "recomendacion_psicologa": eval_res.get("recomendacion_psicologa", "")
                }
                client_report["evaluaciones"].append(cand_entry)

            # Ordenar evaluaciones del cliente de mayor a menor score
            client_report["evaluaciones"].sort(key=lambda x: x["score_global"], reverse=True)
            summary_stats["clientes"].append(client_report)

        # Guardar en JSON estructurado
        output_file = "/app/ronda5_full_120_evaluations.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(summary_stats, f, indent=2, ensure_ascii=False)

        print(f"✓ Reporte detallado generado exitosamente en: {output_file}")
        print(f"  Total clientes evaluados: {len(summary_stats['clientes'])}")
        print(f"  Total evaluaciones: {summary_stats['total_evaluaciones']}")
        print(f"  Distribución de Veredictos:")
        for verd, cnt in summary_stats["verdict_counts"].items():
            print(f"    - {verd}: {cnt}")
        print(f"  Fricciones detectadas: {summary_stats['total_fricciones']}")
        print(f"  Dealbreakers detectados: {summary_stats['total_dealbreakers']}")

if __name__ == '__main__':
    asyncio.run(generate_detailed_report())
