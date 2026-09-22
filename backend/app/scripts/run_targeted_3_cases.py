import asyncio
import os
import sys
import json
import time
from fastapi import Response
from app.database import AsyncSessionLocal
from app.routers.matchmaking import get_interview_results

TARGET_CLIENTS = [
    {"identifier": "Andres Felipe Gómez Marín", "label": "Caso 4 (Hallazgo 2 - Puntos Fuertes Anclados a Hechos)"},
    {"identifier": "Manuela Peña Gomez", "label": "Caso 8 (Hallazgo 3 - Concordancia Negativa No Hijos)"},
    {"identifier": "Katerine Garcia", "label": "Caso 14 (Hallazgo 3 - Concordancia Negativa No Hijos)"}
]

async def run_targeted():
    print("=" * 60)
    print("🚀 EJECUTANDO EVALUACIÓN DIRIGIDA DE LOS 3 CASOS CLAVE")
    print("=" * 60)

    results = []
    async with AsyncSessionLocal() as db:
        for tc in TARGET_CLIENTS:
            ident = tc["identifier"]
            label = tc["label"]
            print(f"\n---> Evaluando {ident} [{label}]...")
            t0 = time.time()
            resp = Response()
            try:
                res = await get_interview_results(ident, resp, current_user={"id": "admin-targeted"}, db=db)
                elapsed = round(time.time() - t0, 2)
                matches = res.get("suggested_matches", [])
                top = matches[0] if matches else None

                record = {
                    "identifier": ident,
                    "label": label,
                    "elapsed_seconds": elapsed,
                    "top_match": {
                        "candidate_name": top.get("name") if top else None,
                        "compatibility_pct": top.get("compatibility_pct") if top else None,
                        "ai_score": top.get("ai_score") if top else None,
                        "ai_veredicto": top.get("ai_veredicto") if top else None,
                        "puntos_fuertes": top.get("ai_puntos_fuertes", []) if top else [],
                        "deal_breakers": top.get("ai_deal_breakers", []) if top else [],
                        "red_flags_seguridad": top.get("ai_red_flags_seguridad", []) if top else [],
                        "analisis": top.get("ai_analisis") if top else ""
                    } if top else None
                }
                results.append(record)
                print(f"  ✓ Completado en {elapsed}s | Top Match: {top.get('name') if top else 'None'} ({top.get('compatibility_pct') if top else 0}%)")
                print(f"    Veredicto: {top.get('ai_veredicto') if top else 'None'}")
                print(f"    Puntos Fuertes: {json.dumps(top.get('ai_puntos_fuertes', []), ensure_ascii=False)}")
                print(f"    Deal Breakers: {json.dumps(top.get('ai_deal_breakers', []), ensure_ascii=False)}")
            except Exception as e:
                print(f"  ✗ Error evaluando {ident}: {e}")
                results.append({"identifier": ident, "error": str(e)})

    out_path = "/app/scripts/targeted_after_results.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nResultados guardados en {out_path}")

if __name__ == "__main__":
    asyncio.run(run_targeted())
