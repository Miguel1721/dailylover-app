import asyncio
from fastapi import Response
from app.database import AsyncSessionLocal
from app.routers.matchmaking import get_interview_results

async def main():
    async with AsyncSessionLocal() as db:
        res = await get_interview_results("Andres Felipe Gómez Marín", Response(), current_user={"id": "admin"}, db=db)
        discarded = res.get("discarded_matches", [])
        print(f"Total discarded: {len(discarded)}")
        for d in discarded:
            if "Mariana" in d.get("candidate_name", ""):
                print("MARIANA DISCARD REASONS:", d)
        print("Sample 5 discards:")
        for d in discarded[:5]:
            print(d.get("candidate_name"), "->", d.get("reasons"))

if __name__ == '__main__':
    asyncio.run(main())
