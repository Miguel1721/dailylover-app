import asyncio
import json
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.routers.matchmaking import resolve_person_email_and_id

async def main():
    with open("/tmp/fase1_twins_merge_case_by_case_audit.json", "r", encoding="utf-8") as f:
        full_fase1 = json.load(f)
    blocked = full_fase1["blocked_email_collisions"]
    t2_by_uid = {c["side_a_no_profile"]["user_id"]: c for c in blocked}

    async with AsyncSessionLocal() as db:
        r1 = await db.execute(text("""
            SELECT feedback_email_status, feedback_email_target, COUNT(*) AS cnt
            FROM scheduled_dates
            WHERE feedback_email_sent_at IS NOT NULL
            GROUP BY 1, 2
        """))
        print("=== SCHEDULED_DATES FEEDBACK STATUS BREAKDOWN ===")
        for row in r1.fetchall():
            print(" ", dict(row._mapping))

        # Check all scheduled_dates where feedback_email_sent_at IS NOT NULL:
        # Did resolve_person_email_and_id resolve either person_a or person_b to a Table 2 shifted-email UID?
        r2 = await db.execute(text("""
            SELECT id, match_id, person_a, person_b, date_time, feedback_email_sent_at, feedback_email_status, feedback_email_target
            FROM scheduled_dates
            WHERE feedback_email_sent_at IS NOT NULL
            ORDER BY id
        """))
        sd_sent_rows = [dict(r._mapping) for r in r2.fetchall()]
        contaminated_test_dispatches = []
        for r in sd_sent_rows:
            for side_key in ("person_a", "person_b"):
                pname = r.get(side_key)
                uid, em = await resolve_person_email_and_id(db, pname)
                if uid in t2_by_uid:
                    col = t2_by_uid[uid]
                    contaminated_test_dispatches.append({
                        "scheduled_date_id": r["id"],
                        "side": side_key,
                        "person_name_in_cita": pname,
                        "resolved_uid": uid,
                        "shifted_email_configured": em,
                        "true_email_owner_name": col["side_b_email_owner_with_profile"]["name"],
                        "true_email_owner_uid": col["side_b_email_owner_with_profile"]["user_id"],
                        "feedback_email_status": r["feedback_email_status"],
                        "feedback_email_target_actually_used": r["feedback_email_target"],
                        "sent_at": str(r["feedback_email_sent_at"]),
                    })

        print(f"=== CONTAMINATED TEST DISPATCHES IN SCHEDULED_DATES: {len(contaminated_test_dispatches)} ===")
        for x in contaminated_test_dispatches[:25]:
            print(" ", x)

        with open("/tmp/sd_contaminated_test_dispatches.json", "w", encoding="utf-8") as f:
            json.dump({
                "status_breakdown": [dict(row._mapping) for row in (await db.execute(text("SELECT feedback_email_status, feedback_email_target, COUNT(*) AS cnt FROM scheduled_dates WHERE feedback_email_sent_at IS NOT NULL GROUP BY 1, 2"))).fetchall()],
                "contaminated_test_dispatches_count": len(contaminated_test_dispatches),
                "contaminated_test_dispatches": contaminated_test_dispatches,
            }, f, ensure_ascii=False, indent=2)

asyncio.run(main())
