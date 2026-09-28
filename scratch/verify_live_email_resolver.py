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
        res_isa = await resolve_person_email_and_id(db, "Isabella Luquetta")
        res_diana = await resolve_person_email_and_id(db, "Diana Coral Guerrero")
        res_miguel = await resolve_person_email_and_id(db, "Miguel Angel Duarte Sánchez")
        res_manuel = await resolve_person_email_and_id(db, "MANUEL ALEJANDRO BELTRAN")
        print("Live DB resolve_person_email_and_id('Isabella Luquetta') ->", res_isa)
        print("Live DB resolve_person_email_and_id('Diana Coral Guerrero') ->", res_diana)
        print("Live DB resolve_person_email_and_id('Miguel Angel Duarte Sánchez') ->", res_miguel)
        print("Live DB resolve_person_email_and_id('MANUEL ALEJANDRO BELTRAN') ->", res_manuel)

        assert res_isa == (12011, "isalu.luquetta@gmail.com"), f"Unexpected Isabella result: {res_isa}"
        assert res_diana == (11520, "diana.coral.g@gmail.com"), f"Unexpected Diana result: {res_diana}"
        assert res_diana[1] != "isalu.luquetta@gmail.com", f"Diana leaked Isabella's email: {res_diana}"
        assert res_miguel[1] != "cespedes.daniele2310@gmail.com", f"Miguel leaked email: {res_miguel}"
        assert res_manuel[1] != "tatianajaramillov@gmail.com", f"Manuel leaked email: {res_manuel}"

        # Re-check all 544 scheduled_dates with feedback_email_sent_at IS NOT NULL
        r2 = await db.execute(text("""
            SELECT id, person_a, person_b
            FROM scheduled_dates
            WHERE feedback_email_sent_at IS NOT NULL
            ORDER BY id
        """))
        sd_rows = [dict(r._mapping) for r in r2.fetchall()]
        leaked = []
        for r in sd_rows:
            for side_key in ("person_a", "person_b"):
                pname = r.get(side_key)
                uid, em = await resolve_person_email_and_id(db, pname)
                if uid in t2_by_uid and em:
                    col = t2_by_uid[uid]
                    true_owner = col["side_b_email_owner_with_profile"]["name"]
                    true_owner_email = str(col["side_b_email_owner_with_profile"]["email"] or "").strip().lower()
                    if em.strip().lower() == true_owner_email and true_owner.strip().lower() not in pname.strip().lower():
                        if "isalu" in em.lower() and "isabella" in pname.lower():
                            continue
                        leaked.append((r["id"], side_key, pname, uid, em, "Leaked from true owner:", true_owner))
        print(f"Scheduled dates leaking another person's email after fix: {len(leaked)}")
        assert len(leaked) == 0, f"Still leaking: {leaked}"

asyncio.run(main())
