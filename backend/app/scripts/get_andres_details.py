import asyncio
import json
from fastapi import Response
from app.database import AsyncSessionLocal
from app.routers.matchmaking import get_interview_results

async def main():
    async with AsyncSessionLocal() as db:
        res = await get_interview_results("Andres Felipe Gómez Marín", Response(), current_user={"id": "admin"}, db=db)
        matches = res.get("suggested_matches", [])
        for m in matches:
            if "Mariana Quintero" in m.get("name", ""):
                print("="*60)
                print("MATCH FOUND: Mariana Quintero")
                print("Compatibility:", m.get("compatibility_pct"))
                print("AI Score:", m.get("ai_score"))
                print("Veredicto:", m.get("ai_veredicto"))
                print("Puntos Fuertes:", json.dumps(m.get("ai_puntos_fuertes"), ensure_ascii=False, indent=2))
                print("Deal Breakers:", json.dumps(m.get("ai_deal_breakers"), ensure_ascii=False, indent=2))
                print("Analisis:", m.get("ai_analisis"))
                print("Client Summary:", json.dumps(m.get("ai_client_summary"), ensure_ascii=False, indent=2))
                print("Candidate Summary:", json.dumps(m.get("ai_candidate_summary"), ensure_ascii=False, indent=2))

if __name__ == '__main__':
    asyncio.run(main())
