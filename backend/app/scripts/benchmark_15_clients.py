import asyncio
import os
import sys
import json
import time
from typing import List, Dict, Any
from fastapi import Response
from app.database import AsyncSessionLocal
from app.routers.matchmaking import get_interview_results

# Muestra curada de 15 a 20 clientes representativos de producción:
# Cubre Bogotá, Medellín, Cali, Barranquilla, diferentes psicólogas y niveles de completitud.
TEST_CLIENTS = [
    # 1. Bogotá - Silvi - Notas extensas (>1500 chars), perfil senior
    {"identifier": "Nelson David Calderón", "city_target": "Bogotá", "psyc": "Silvi", "type": "Notas muy extensas (>1500 chars)"},
    # 2. Bogotá - Silvi - Notas muy extensas (>3000 chars), relación previa compleja
    {"identifier": "Maria Paula Lamus", "city_target": "Bogotá", "psyc": "Silvi", "type": "Notas ultra extensas (>3000 chars)"},
    # 3. Bogotá - Ana - Notas medianas (~750 chars), turnos rotativos
    {"identifier": "Katherine Martínez", "city_target": "Bogotá", "psyc": "Ana", "type": "Notas medianas (~750 chars)"},
    # 4. Bogotá - Steffy - VIP, altas exigencias
    {"identifier": "Andres Felipe Gómez Marín", "city_target": "Bogotá / Cajica", "psyc": "Steffy", "type": "Economista / Perfil VIP"},
    # 5. Bogotá - Jenn - Notas de diseño / arte
    {"identifier": "Sharon nicolle Gil ariza", "city_target": "Bogotá", "psyc": "Jenn", "type": "Diseño / Perfil joven"},
    # 6. Medellín - Aleja - Fitness / Estilo de vida El Poblado
    {"identifier": "Maria Alejandra Marroquin", "city_target": "Medellín", "psyc": "Aleja", "type": "Medellín / Fitness"},
    # 7. Medellín - Aleja - Profesional independiente
    {"identifier": "Laura Alza", "city_target": "Medellín", "psyc": "Aleja", "type": "Medellín / Corporativo"},
    # 8. Medellín - Manu - Notas de apego declaradas
    {"identifier": "Manuela Peña Gomez", "city_target": "Medellín", "psyc": "Manu", "type": "Medellín / Apego"},
    # 9. Cali - Lau - Profesional local Cali
    {"identifier": "Stephany Martinez Hadechni", "city_target": "Cali", "psyc": "Lau", "type": "Cali / Familia"},
    # 10. Barranquilla - Steffy - Costa Caribe
    {"identifier": "Angie Nohemi Ortiz Rodriguez", "city_target": "Barranquilla / Costa", "psyc": "Steffy", "type": "Costa / Distancia"},
    # 11. Bogotá - Mape D - Notas directas
    {"identifier": "Andrea Alejandra Linares Herrera", "city_target": "Bogotá", "psyc": "Mape D", "type": "Bogotá / Administrativo"},
    # 12. Bogotá - Ana - Perfil con hijos / familia
    {"identifier": "Carlos Arturo Vargas Nocua", "city_target": "Bogotá", "psyc": "Ana", "type": "ID 11480 / Caso histórico"},
    # 13. Bogotá - Silvi - Financiero
    {"identifier": "Nathalia Andrea Serrano Urrea", "city_target": "Bogotá", "psyc": "Silvi", "type": "Financiero / Proyectos"},
    # 14. Bogotá - Jenn - Comercial
    {"identifier": "Katerine Garcia", "city_target": "Bogotá", "psyc": "Jenn", "type": "Comercial / Independiente"},
    # 15. Medellín - Manu - Notas breves / perfil parcial
    {"identifier": "Cliente CRM 757", "city_target": "Chía / Sabana", "psyc": "Silvi", "type": "Ingeniera Química"}
]

async def run_benchmark():
    print(f"\n========================================================")
    print(f"🚀 INICIANDO BENCHMARK AUDITORÍA 360 ({len(TEST_CLIENTS)} CLIENTES)")
    print(f"========================================================\n", flush=True)

    results = []
    total_start = time.time()

    async with AsyncSessionLocal() as db:
        for idx, tc in enumerate(TEST_CLIENTS, start=1):
            ident = tc["identifier"]
            print(f"\n[{idx}/{len(TEST_CLIENTS)}] Evaluando: '{ident}' ({tc['city_target']} | {tc['psyc']})...", flush=True)
            t0 = time.time()

            try:
                resp = Response()
                res = await get_interview_results(ident, resp, current_user={"id": "admin-benchmark"}, db=db)
                elapsed = round(time.time() - t0, 2)

                client = res.get("client", {})
                matches = res.get("suggested_matches", [])
                discarded = res.get("discarded_matches", [])

                top = matches[0] if matches else None
                ai_score = top.get("ai_score") if top else None
                ai_verdict = top.get("ai_veredicto") if top else None
                comp_pct = top.get("compatibility_pct") if top else None
                struct_score = top.get("structural_score") if top else None
                dbs = top.get("ai_deal_breakers", []) if top else []
                pts = top.get("ai_puntos_fuertes", []) if top else []
                client_summ = top.get("ai_client_summary") if top else None
                cand_summ = top.get("ai_candidate_summary") if top else None
                analisis = top.get("ai_analisis") if top else ""

                entry = {
                    "index": idx,
                    "target_client": ident,
                    "target_city": tc["city_target"],
                    "target_psyc": tc["psyc"],
                    "target_type": tc["type"],
                    "client_real_name": client.get("name"),
                    "client_city": client.get("city"),
                    "client_age": client.get("age"),
                    "client_occupation": client.get("occupation"),
                    "client_notes_length": len(client.get("bio_notes") or ""),
                    "suggested_matches_count": len(matches),
                    "discarded_count": len(discarded),
                    "elapsed_seconds": elapsed,
                    "top_match": {
                        "name": top.get("name") if top else None,
                        "age": top.get("age") if top else None,
                        "city": top.get("city") if top else None,
                        "occupation": top.get("occupation") if top else None,
                        "compatibility_pct": comp_pct,
                        "structural_score": struct_score,
                        "ai_score": ai_score,
                        "ai_veredicto": ai_verdict,
                        "red_flags_seguridad": top.get("ai_red_flags_seguridad") or (top.get("comparison", {}).get("red_flags_seguridad") if isinstance(top.get("comparison"), dict) else []) or [],
                        "deal_breakers": dbs,
                        "puntos_fuertes": pts,
                        "analisis": analisis,
                        "client_summary": client_summ,
                        "candidate_summary": cand_summ
                    } if top else None,
                    "safety_disqualified_count": sum(1 for d in discarded if any("RED FLAG DE SEGURIDAD" in str(r) for r in d.get("reasons", []))),
                    "safety_disqualified_candidates": [
                        {"name": d.get("candidate_name"), "reasons": d.get("reasons")}
                        for d in discarded if any("RED FLAG DE SEGURIDAD" in str(r) for r in d.get("reasons", []))
                    ]
                }

                results.append(entry)

                print(f"  ✓ Completado en {elapsed}s | Matches: {len(matches)} | Descartadas: {len(discarded)}")
                if entry.get("safety_disqualified_count", 0) > 0:
                    print(f"    🚨 Descalificados por Seguridad: {entry['safety_disqualified_count']} candidatos ({[c['name'] for c in entry['safety_disqualified_candidates']]})")
                if top:
                    print(f"    Top Match: {top.get('name')} | Comp: {comp_pct}% | AI: {ai_score} ({ai_verdict})")
                    if client_summ:
                        print(f"    [SÍNTESIS A] Quién: {client_summ.get('quien_es', '')[:60]}... | Busca: {client_summ.get('que_busca', '')[:60]}...")
                    if cand_summ:
                        print(f"    [SÍNTESIS B] Quién: {cand_summ.get('quien_es', '')[:60]}... | Busca: {cand_summ.get('que_busca', '')[:60]}...")
                    if dbs:
                        print(f"    Dealbreakers: {dbs}")
                else:
                    print(f"    ⚠️ Sin candidatos viables encontrados.")

            except Exception as e:
                elapsed = round(time.time() - t0, 2)
                print(f"  ❌ Error evaluando '{ident}' ({elapsed}s): {e}", flush=True)
                results.append({
                    "index": idx,
                    "target_client": ident,
                    "error": str(e),
                    "elapsed_seconds": elapsed
                })

    total_elapsed = round(time.time() - total_start, 2)
    print(f"\n========================================================")
    print(f"✅ BENCHMARK FINALIZADO EN {total_elapsed}s")
    print(f"========================================================\n", flush=True)

    # Guardar resultados en JSON
    output_path = "/app/benchmark_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "total_clients": len(TEST_CLIENTS),
            "total_elapsed_seconds": total_elapsed,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "results": results
        }, f, ensure_ascii=False, indent=2)
    print(f"Resultados guardados en {output_path}")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
