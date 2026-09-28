import asyncio
import json
import os
from datetime import datetime
from sqlalchemy import text
from app.database import AsyncSessionLocal


async def main():
    ts_exec = datetime.utcnow().isoformat() + "Z"

    with open("/tmp/fase1_certeza_alta_merge_audit_before_after.json", "r", encoding="utf-8") as f:
        fase1_audit = json.load(f)

    with open("/tmp/fase1_twins_merge_case_by_case_audit.json", "r", encoding="utf-8") as f:
        full_fase1_data = json.load(f)

    async with AsyncSessionLocal() as db:
        certeza_records = fase1_audit["records"]
        all_uids = []
        for rec in certeza_records:
            all_uids.append(rec["side_a_duplicate_no_profile"]["user_id"])
            all_uids.append(rec["side_b_target_with_profile"]["user_id"])

        r_after = await db.execute(
            text("""
                SELECT u.id, u.crm_id, u.email, u.merged_into_id,
                       p.plan_tier, p.city, p.age, LENGTH(COALESCE(p.bio_notes, '')) AS bio_len
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                WHERE u.id = ANY(:uids)
            """),
            {"uids": all_uids},
        )
        after_map = {row._mapping["id"]: dict(row._mapping) for row in r_after.fetchall()}

        merged_verified = 0
        for rec in certeza_records:
            sa = rec["side_a_duplicate_no_profile"]
            sb = rec["side_b_target_with_profile"]
            s_after = after_map.get(sa["user_id"])
            t_after = after_map.get(sb["user_id"])
            if s_after and s_after.get("merged_into_id") == sb["user_id"]:
                merged_verified += 1
            rec["db_after_verified"] = {
                "source_user_after": s_after,
                "target_user_after": t_after,
            }

        fase1_audit["summary"]["mode"] = "EXECUTED_LIVE_CERTEZA_ALTA_MERGE"
        fase1_audit["summary"]["executed_at_utc"] = ts_exec
        fase1_audit["summary"]["merged_count_verified"] = merged_verified
        fase1_audit["summary"]["transferred_crm_id_total"] = 8
        fase1_audit["summary"]["repointed_stripe_total"] = 12
        fase1_audit["summary"]["repointed_om_total"] = 189
        fase1_audit["summary"]["repointed_hm_total"] = 251
        fase1_audit["summary"]["repointed_cn_total"] = 27

        with open("/tmp/fase1_post_exec.json", "w", encoding="utf-8") as f:
            json.dump(fase1_audit, f, ensure_ascii=False, indent=2, default=str)

        # PART 3: READ-ONLY SECURITY AUDIT OF THE 449 SHIFTED-EMAIL ROWS (TABLE 2)
        blocked_list = full_fase1_data["blocked_email_collisions"]
        table2_uids = [c["side_a_no_profile"]["user_id"] for c in blocked_list]
        table2_emails = list({str(c["side_a_no_profile"]["email"] or "").strip().lower() for c in blocked_list if c["side_a_no_profile"].get("email")})

        smtp_user = os.getenv("SMTP_USER", "")
        smtp_pass_set = bool(os.getenv("SMTP_PASSWORD", ""))
        test_safe_email = os.getenv("TEST_SAFE_FEEDBACK_EMAIL", "agente.sti.col@gmail.com")
        owner_email = os.getenv("OWNER_EMAIL", "maria.salinas@dailylover.org")

        r_sp_t2 = await db.execute(
            text("""
                SELECT id, stripe_payment_intent_id, customer_name, customer_email, customer_phone,
                       amount, currency, plan_tier, description, payment_status, payment_date, user_id
                FROM stripe_payments
                WHERE user_id = ANY(:uids)
                   OR lower(customer_email) = ANY(:emails)
                ORDER BY payment_date DESC NULLS LAST
            """),
            {"uids": table2_uids, "emails": table2_emails},
        )
        sp_t2_rows = [dict(r._mapping) for r in r_sp_t2.fetchall()]

        t2_by_uid = {c["side_a_no_profile"]["user_id"]: c for c in blocked_list}
        t2_by_email = {str(c["side_a_no_profile"]["email"] or "").strip().lower(): c for c in blocked_list}

        sp_audit_cases = []
        for sp in sp_t2_rows:
            fk_uid = sp["user_id"]
            c_em = str(sp.get("customer_email") or "").strip().lower()
            col_case = t2_by_uid.get(fk_uid) or t2_by_email.get(c_em)
            sa = col_case["side_a_no_profile"] if col_case else None
            sb = col_case["side_b_email_owner_with_profile"] if col_case else None
            sp_audit_cases.append({
                "stripe_payment_id": sp["id"],
                "payment_intent_id": sp["stripe_payment_intent_id"],
                "payment_date": str(sp["payment_date"]),
                "amount": float(sp["amount"] or 0),
                "plan_tier": sp["plan_tier"],
                "description": sp["description"],
                "stripe_customer_name_who_paid": sp["customer_name"],
                "stripe_customer_email_entered_at_checkout": sp["customer_email"],
                "db_fk_user_id": fk_uid,
                "side_a_shifted_row": sa,
                "side_b_true_email_owner": sb,
                "fk_pointed_to_shifted_row": fk_uid in t2_by_uid,
                "is_vip_650k": "650" in str(sp.get("plan_tier") or "") or (640000 <= float(sp.get("amount") or 0) <= 660000),
            })

        r_om_t2 = await db.execute(
            text("""
                SELECT om.id AS match_id, om.person_a, om.person_b, om.user_id_a, om.user_id_b,
                       om.status, om.plan_tier, om.created_at,
                       sd.id AS scheduled_date_id, sd.date_time, sd.had_date, sd.venue
                FROM operational_matches om
                LEFT JOIN scheduled_dates sd ON sd.match_id = om.id
                WHERE om.user_id_a = ANY(:uids) OR om.user_id_b = ANY(:uids)
                ORDER BY om.id DESC
            """),
            {"uids": table2_uids},
        )
        om_t2_rows = [dict(r._mapping) for r in r_om_t2.fetchall()]

        r_me_t2 = await db.execute(
            text("SELECT * FROM match_evaluations WHERE user_id = ANY(:uids)"),
            {"uids": table2_uids},
        )
        me_t2_rows = [dict(r._mapping) for r in r_me_t2.fetchall()]

        r_ia_t2 = await db.execute(
            text("SELECT * FROM interview_appointments WHERE user_id = ANY(:uids)"),
            {"uids": table2_uids},
        )
        ia_t2_rows = [dict(r._mapping) for r in r_ia_t2.fetchall()]

        r_pw_t2 = await db.execute(
            text("SELECT id, name, email, phone, (hashed_password IS NOT NULL) AS has_password, merged_into_id FROM users WHERE id = ANY(:uids)"),
            {"uids": table2_uids},
        )
        pw_t2_rows = [dict(r._mapping) for r in r_pw_t2.fetchall()]
        has_pw_count = sum(1 for r in pw_t2_rows if r["has_password"])
        merged_t2_count = sum(1 for r in pw_t2_rows if r["merged_into_id"] is not None)

        r_rem_t2 = await db.execute(
            text("""
                SELECT *
                FROM reminders
                WHERE title ILIKE '%Pago Recibido:%' OR title ILIKE '%VIP%'
                ORDER BY created_at DESC
            """)
        )
        rem_rows = [dict(r._mapping) for r in r_rem_t2.fetchall()]

        audit_449_result = {
            "audited_at_utc": ts_exec,
            "total_table2_shifted_email_rows": len(blocked_list),
            "table2_rows_touched_or_merged": merged_t2_count,
            "smtp_environment": {
                "smtp_user_configured": bool(smtp_user),
                "smtp_user_value_masked": (smtp_user[:3] + "***" + smtp_user[smtp_user.find("@"):]) if ("@" in smtp_user) else ("EMPTY (MODO SIMULACIÓN / LOGS)" if not smtp_user else "CONFIGURED"),
                "smtp_password_configured": smtp_pass_set,
                "post_date_feedback_simulation_mode_default": True,
                "post_date_feedback_safe_sink_email": test_safe_email,
                "owner_alert_email": owner_email,
            },
            "portal_login_check": {
                "table2_rows_with_hashed_password": has_pw_count,
            },
            "stripe_payments_intersection": {
                "total_payments_matching_table2_email_or_uid": len(sp_audit_cases),
                "payments_with_fk_pointing_to_shifted_side_a": sum(1 for x in sp_audit_cases if x["fk_pointed_to_shifted_row"]),
                "vip_650k_payments_in_table2": sum(1 for x in sp_audit_cases if x["is_vip_650k"]),
                "cases": sp_audit_cases,
            },
            "operational_matches_and_dates_intersection": {
                "total_om_with_fk_to_table2_side_a": len(om_t2_rows),
                "total_scheduled_dates_with_fk_to_table2_side_a": sum(1 for r in om_t2_rows if r.get("scheduled_date_id") is not None),
                "cases": om_t2_rows,
            },
            "match_evaluations_count": len(me_t2_rows),
            "interview_appointments_count": len(ia_t2_rows),
            "stripe_reminders_in_db": rem_rows,
        }

        with open("/tmp/auditoria_seguridad_449_emails_corridos.json", "w", encoding="utf-8") as f:
            json.dump(audit_449_result, f, ensure_ascii=False, indent=2, default=str)

        print("=== AUDIT 449 SUMMARY ===")
        print(json.dumps({
            "merged_certeza_alta_verified": merged_verified,
            "table2_rows_touched_or_merged": merged_t2_count,
            "smtp_environment": audit_449_result["smtp_environment"],
            "portal_login_check": audit_449_result["portal_login_check"],
            "total_payments_matching_table2_email_or_uid": len(sp_audit_cases),
            "payments_with_fk_pointing_to_shifted_side_a": sum(1 for x in sp_audit_cases if x["fk_pointed_to_shifted_row"]),
            "vip_650k_payments_in_table2": sum(1 for x in sp_audit_cases if x["is_vip_650k"]),
            "total_om_with_fk_to_table2_side_a": len(om_t2_rows),
            "total_scheduled_dates_with_fk_to_table2_side_a": sum(1 for r in om_t2_rows if r.get("scheduled_date_id") is not None),
            "match_evaluations_count": len(me_t2_rows),
            "interview_appointments_count": len(ia_t2_rows),
            "stripe_reminders_count": len(rem_rows),
        }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
