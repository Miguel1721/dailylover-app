import asyncio
import json
import os
from datetime import datetime
from sqlalchemy import text
from app.database import AsyncSessionLocal


def json_Or_none(val):
    if val is None or val == {} or val == []:
        return None
    if isinstance(val, str):
        return val
    return json.dumps(val, ensure_ascii=False)


async def run_all():
    ts_exec = datetime.utcnow().isoformat() + "Z"

    with open("/tmp/fase2_profiles_insert_audit_before_after.json", "r", encoding="utf-8") as f:
        fase2_audit = json.load(f)

    with open("/tmp/fase1_certeza_alta_merge_audit_before_after.json", "r", encoding="utf-8") as f:
        fase1_audit = json.load(f)

    with open("/tmp/fase1_twins_merge_case_by_case_audit.json", "r", encoding="utf-8") as f:
        full_fase1_data = json.load(f)

    async with AsyncSessionLocal() as db:
        # =====================================================================
        # PART 1: FASE 2 LIVE INSERT INTO PROFILES (645 RECORDS)
        # =====================================================================
        print("=== STARTING FASE 2 LIVE INSERT (645 RECORDS) ===")
        fase2_records = fase2_audit["records"]
        fase2_uids = [r["user_id"] for r in fase2_records]

        # Check pre-insert existing profiles (should be 0)
        res_pre = await db.execute(
            text("SELECT user_id FROM profiles WHERE user_id = ANY(:uids)"),
            {"uids": fase2_uids},
        )
        already_existing_f2 = {r[0] for r in res_pre.fetchall()}
        print(f"Pre-insert existing profiles among 645: {len(already_existing_f2)}")

        inserted_f2_count = 0
        for rec in fase2_records:
            uid = rec["user_id"]
            ap = rec["after_profile"]
            # If birth_date exists, preserve it inside lifestyle if lifestyle is dict
            lifestyle_obj = dict(ap.get("lifestyle") or {})
            if ap.get("birth_date") and "birth_date" not in lifestyle_obj:
                lifestyle_obj["birth_date"] = ap["birth_date"]

            res_ins = await db.execute(
                text("""
                    INSERT INTO profiles (
                        user_id, full_name_raw, gender, age, city, neighborhood,
                        estatura, occupation, education, religion, love_language,
                        orientation, apego, plan_tier, responsable, bio_notes,
                        lifestyle, search_preferences, updated_at
                    ) VALUES (
                        :user_id, :full_name_raw, :gender, :age, :city, :neighborhood,
                        :estatura, :occupation, :education, :religion, :love_language,
                        :orientation, CAST(:apego AS jsonb), :plan_tier, :responsable, :bio_notes,
                        CAST(:lifestyle AS jsonb), CAST(:search_preferences AS jsonb), NOW()
                    )
                    ON CONFLICT (user_id) DO NOTHING
                    RETURNING user_id
                """),
                {
                    "user_id": uid,
                    "full_name_raw": rec.get("name"),
                    "gender": ap.get("gender"),
                    "age": int(ap["age"]) if ap.get("age") is not None else None,
                    "city": ap.get("city"),
                    "neighborhood": ap.get("neighborhood"),
                    "estatura": str(ap["estatura"]) if ap.get("estatura") is not None else None,
                    "occupation": ap.get("occupation"),
                    "education": ap.get("education"),
                    "religion": ap.get("religion"),
                    "love_language": ap.get("love_language"),
                    "orientation": ap.get("orientation"),
                    "apego": json_Or_none(ap.get("apego")),
                    "plan_tier": ap.get("plan_tier"),
                    "responsable": ap.get("responsable"),
                    "bio_notes": ap.get("bio_notes"),
                    "lifestyle": json_Or_none(lifestyle_obj),
                    "search_preferences": json_Or_none(ap.get("search_preferences")),
                },
            )
            if res_ins.fetchone():
                inserted_f2_count += 1

        await db.commit()
        print(f"Fase 2 committed: {inserted_f2_count} new profiles inserted.")

        # Verify post-insert state for all 645 records
        res_post_f2 = await db.execute(
            text("""
                SELECT user_id, gender, age, city, neighborhood, estatura,
                       occupation, education, religion, love_language, orientation,
                       apego, plan_tier, responsable, bio_notes, lifestyle,
                       search_preferences, updated_at
                FROM profiles
                WHERE user_id = ANY(:uids)
            """),
            {"uids": fase2_uids},
        )
        post_f2_by_uid = {r._mapping["user_id"]: dict(r._mapping) for r in res_post_f2.fetchall()}
        print(f"Post-insert verified profiles among 645: {len(post_f2_by_uid)} / {len(fase2_uids)}")

        for rec in fase2_records:
            uid = rec["user_id"]
            db_p = post_f2_by_uid.get(uid)
            rec["db_after_verified"] = {
                "profile_exists_in_db": db_p is not None,
                "gender": db_p.get("gender") if db_p else None,
                "age": db_p.get("age") if db_p else None,
                "city": db_p.get("city") if db_p else None,
                "plan_tier": db_p.get("plan_tier") if db_p else None,
                "responsable": db_p.get("responsable") if db_p else None,
                "bio_notes_len": len(db_p.get("bio_notes") or "") if db_p else 0,
                "has_lifestyle": bool(db_p.get("lifestyle")) if db_p else False,
                "has_search_preferences": bool(db_p.get("search_preferences")) if db_p else False,
                "updated_at": str(db_p.get("updated_at")) if db_p else None,
            }

        fase2_audit["mode"] = "EXECUTED_LIVE_ADDITIVE_INSERT_PROFILES"
        fase2_audit["executed_at_utc"] = ts_exec
        fase2_audit["inserted_count"] = inserted_f2_count
        fase2_audit["verified_after_count"] = len(post_f2_by_uid)

        with open("/tmp/fase2_profiles_insert_audit_before_after.json", "w", encoding="utf-8") as f:
            json.dump(fase2_audit, f, ensure_ascii=False, indent=2, default=str)

        # =====================================================================
        # PART 2: FASE 1 LIVE CERTEZA ALTA MERGE (461 CLEAN CASES)
        # =====================================================================
        print("=== STARTING FASE 1 LIVE MERGE (461 CLEAN CERTEZA ALTA CASES) ===")
        certeza_records = fase1_audit["records"]

        merged_count = 0
        repointed_stripe_total = 0
        repointed_om_total = 0
        repointed_hm_total = 0
        repointed_cn_total = 0
        repointed_pct_total = 0
        transferred_crm_id_total = 0

        for rec in certeza_records:
            sa = rec["side_a_duplicate_no_profile"]
            sb = rec["side_b_target_with_profile"]
            source_uid = sa["user_id"]
            target_uid = sb["user_id"]

            # 1. Fetch current DB state of source and target users
            r_u = await db.execute(
                text("SELECT id, name, phone, email, crm_id, merged_into_id FROM users WHERE id IN (:s, :t)"),
                {"s": source_uid, "t": target_uid},
            )
            u_map = {row._mapping["id"]: dict(row._mapping) for row in r_u.fetchall()}
            su = u_map.get(source_uid)
            tu = u_map.get(target_uid)
            if not su or not tu:
                continue

            # 2. Coalesce profile fields from source_uid (if exists from Fase 2) into target_uid
            await db.execute(
                text("""
                    UPDATE profiles AS t
                    SET
                        gender = COALESCE(NULLIF(TRIM(t.gender), ''), NULLIF(TRIM(s.gender), ''), t.gender),
                        age = COALESCE(t.age, s.age),
                        city = COALESCE(NULLIF(TRIM(t.city), ''), NULLIF(TRIM(s.city), ''), t.city),
                        neighborhood = COALESCE(NULLIF(TRIM(t.neighborhood), ''), NULLIF(TRIM(s.neighborhood), ''), t.neighborhood),
                        estatura = COALESCE(NULLIF(TRIM(t.estatura), ''), NULLIF(TRIM(s.estatura), ''), t.estatura),
                        occupation = COALESCE(NULLIF(TRIM(t.occupation), ''), NULLIF(TRIM(s.occupation), ''), t.occupation),
                        education = COALESCE(NULLIF(TRIM(t.education), ''), NULLIF(TRIM(s.education), ''), t.education),
                        religion = COALESCE(NULLIF(TRIM(t.religion), ''), NULLIF(TRIM(s.religion), ''), t.religion),
                        love_language = COALESCE(NULLIF(TRIM(t.love_language), ''), NULLIF(TRIM(s.love_language), ''), t.love_language),
                        orientation = COALESCE(NULLIF(TRIM(t.orientation), ''), NULLIF(TRIM(s.orientation), ''), t.orientation),
                        apego = COALESCE(t.apego, s.apego),
                        plan_tier = COALESCE(NULLIF(TRIM(t.plan_tier), ''), NULLIF(TRIM(s.plan_tier), ''), t.plan_tier),
                        responsable = COALESCE(NULLIF(TRIM(t.responsable), ''), NULLIF(TRIM(s.responsable), ''), t.responsable),
                        bio_notes = CASE
                            WHEN t.bio_notes IS NULL OR LENGTH(TRIM(t.bio_notes)) <= 40
                            THEN COALESCE(NULLIF(TRIM(s.bio_notes), ''), t.bio_notes)
                            ELSE t.bio_notes
                        END,
                        lifestyle = COALESCE(t.lifestyle, s.lifestyle),
                        search_preferences = COALESCE(t.search_preferences, s.search_preferences),
                        updated_at = NOW()
                    FROM profiles AS s
                    WHERE t.user_id = :t AND s.user_id = :s
                """),
                {"s": source_uid, "t": target_uid},
            )

            # 3. Transfer crm_id if target has no crm_id and source has crm_id
            s_cid = str(su.get("crm_id") or "").strip()
            t_cid = str(tu.get("crm_id") or "").strip()
            if s_cid and not t_cid:
                await db.execute(text("UPDATE users SET crm_id = NULL WHERE id = :s"), {"s": source_uid})
                await db.execute(text("UPDATE users SET crm_id = :cid WHERE id = :t AND (crm_id IS NULL OR crm_id = '')"), {"cid": s_cid, "t": target_uid})
                transferred_crm_id_total += 1

            # 4. Transfer email if target has no email and source has email
            s_em = str(su.get("email") or "").strip()
            t_em = str(tu.get("email") or "").strip()
            if s_em and not t_em:
                await db.execute(text("UPDATE users SET email = :em WHERE id = :t AND (email IS NULL OR email = '')"), {"em": s_em, "t": target_uid})

            # 5. Repoint FKs from source_uid -> target_uid
            r_sp = await db.execute(
                text("UPDATE stripe_payments SET user_id = :t WHERE user_id = :s RETURNING id"),
                {"s": source_uid, "t": target_uid},
            )
            sp_repointed = len(r_sp.fetchall())
            repointed_stripe_total += sp_repointed

            r_om_a = await db.execute(
                text("UPDATE operational_matches SET user_id_a = :t WHERE user_id_a = :s AND COALESCE(user_id_b, -1) != :t RETURNING id"),
                {"s": source_uid, "t": target_uid},
            )
            r_om_b = await db.execute(
                text("UPDATE operational_matches SET user_id_b = :t WHERE user_id_b = :s AND COALESCE(user_id_a, -1) != :t RETURNING id"),
                {"s": source_uid, "t": target_uid},
            )
            om_repointed = len(r_om_a.fetchall()) + len(r_om_b.fetchall())
            repointed_om_total += om_repointed

            r_hm_a = await db.execute(
                text("UPDATE historical_matches SET user_id_a = :t WHERE user_id_a = :s AND COALESCE(user_id_b, -1) != :t RETURNING id"),
                {"s": source_uid, "t": target_uid},
            )
            r_hm_b = await db.execute(
                text("UPDATE historical_matches SET user_id_b = :t WHERE user_id_b = :s AND COALESCE(user_id_a, -1) != :t RETURNING id"),
                {"s": source_uid, "t": target_uid},
            )
            hm_repointed = len(r_hm_a.fetchall()) + len(r_hm_b.fetchall())
            repointed_hm_total += hm_repointed

            r_cn = await db.execute(
                text("UPDATE client_notes SET user_id = :t WHERE user_id = :s RETURNING id"),
                {"s": source_uid, "t": target_uid},
            )
            cn_repointed = len(r_cn.fetchall())
            repointed_cn_total += cn_repointed

            r_pct = await db.execute(
                text("""
                    UPDATE priority_client_tracking
                    SET user_id = :t
                    WHERE user_id = :s
                      AND NOT EXISTS (SELECT 1 FROM priority_client_tracking p2 WHERE p2.user_id = :t)
                    RETURNING id
                """),
                {"s": source_uid, "t": target_uid},
            )
            pct_repointed = len(r_pct.fetchall())
            repointed_pct_total += pct_repointed

            await db.execute(
                text("UPDATE priority_client_tracking SET candidate_id = :t WHERE candidate_id = :s"),
                {"s": source_uid, "t": target_uid},
            )
            await db.execute(
                text("UPDATE client_images SET user_id = :t WHERE user_id = :s"),
                {"s": source_uid, "t": target_uid},
            )
            await db.execute(
                text("UPDATE cs_novedades SET client_id = :t WHERE client_id = :s"),
                {"s": source_uid, "t": target_uid},
            )
            await db.execute(
                text("UPDATE interview_appointments SET user_id = :t WHERE user_id = :s"),
                {"s": source_uid, "t": target_uid},
            )
            await db.execute(
                text("UPDATE match_evaluations SET user_id = :t WHERE user_id = :s"),
                {"s": source_uid, "t": target_uid},
            )
            await db.execute(
                text("UPDATE accounts_receivable SET user_id = :t WHERE user_id = :s"),
                {"s": source_uid, "t": target_uid},
            )
            await db.execute(
                text("""
                    UPDATE event_attendees ea
                    SET user_id = :t
                    WHERE ea.user_id = :s
                      AND NOT EXISTS (
                          SELECT 1 FROM event_attendees ea2
                          WHERE ea2.user_id = :t AND ea2.event_id = ea.event_id
                      )
                """),
                {"s": source_uid, "t": target_uid},
            )

            # 6. Set merged_into_id on source_uid
            r_m = await db.execute(
                text("""
                    UPDATE users
                    SET merged_into_id = :t
                    WHERE id = :s AND merged_into_id IS NULL
                    RETURNING id, merged_into_id
                """),
                {"s": source_uid, "t": target_uid},
            )
            if r_m.fetchone():
                merged_count += 1

            # 7. Query verified post-merge state
            r_after = await db.execute(
                text("""
                    SELECT u.id, u.crm_id, u.email, u.merged_into_id,
                           p.plan_tier, p.city, p.age, LENGTH(COALESCE(p.bio_notes, '')) AS bio_len
                    FROM users u
                    LEFT JOIN profiles p ON p.user_id = u.id
                    WHERE u.id IN (:s, :t)
                """),
                {"s": source_uid, "t": target_uid},
            )
            after_map = {row._mapping["id"]: dict(row._mapping) for row in r_after.fetchall()}
            rec["db_after_verified"] = {
                "source_user_after": after_map.get(source_uid),
                "target_user_after": after_map.get(target_uid),
                "repointed_stripe_payments": sp_repointed,
                "repointed_operational_matches": om_repointed,
                "repointed_historical_matches": hm_repointed,
                "repointed_client_notes": cn_repointed,
                "repointed_priority_tracking": pct_repointed,
            }

        await db.commit()
        print(
            f"Fase 1 committed: {merged_count} / {len(certeza_records)} merged | "
            f"crm_id transferred={transferred_crm_id_total} | "
            f"Stripe repointed={repointed_stripe_total} | OM repointed={repointed_om_total} | "
            f"HM repointed={repointed_hm_total} | Notes repointed={repointed_cn_total}"
        )

        fase1_audit["summary"]["mode"] = "EXECUTED_LIVE_CERTEZA_ALTA_MERGE"
        fase1_audit["summary"]["executed_at_utc"] = ts_exec
        fase1_audit["summary"]["merged_count_verified"] = merged_count
        fase1_audit["summary"]["transferred_crm_id_total"] = transferred_crm_id_total
        fase1_audit["summary"]["repointed_stripe_total"] = repointed_stripe_total
        fase1_audit["summary"]["repointed_om_total"] = repointed_om_total
        fase1_audit["summary"]["repointed_hm_total"] = repointed_hm_total
        fase1_audit["summary"]["repointed_cn_total"] = repointed_cn_total
        fase1_audit["summary"]["repointed_pct_total"] = repointed_pct_total

        with open("/tmp/fase1_certeza_alta_merge_audit_before_after.json", "w", encoding="utf-8") as f:
            json.dump(fase1_audit, f, ensure_ascii=False, indent=2, default=str)

        # =====================================================================
        # PART 3: READ-ONLY SECURITY AUDIT OF THE 449 SHIFTED-EMAIL ROWS (TABLE 2)
        # =====================================================================
        print("=== STARTING READ-ONLY SECURITY AUDIT ON 449 SHIFTED-EMAIL ROWS ===")
        blocked_list = full_fase1_data["blocked_email_collisions"]
        table2_uids = [c["side_a_no_profile"]["user_id"] for c in blocked_list]
        table2_emails = list({str(c["side_a_no_profile"]["email"] or "").strip().lower() for c in blocked_list if c["side_a_no_profile"].get("email")})

        # 1. Check SMTP environment configuration inside dl_api
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_pass_set = bool(os.getenv("SMTP_PASSWORD", ""))
        test_safe_email = os.getenv("TEST_SAFE_FEEDBACK_EMAIL", "agente.sti.col@gmail.com")
        owner_email = os.getenv("OWNER_EMAIL", "maria.salinas@dailylover.org")

        # 2. Check stripe_payments where user_id is in table2_uids OR customer_email is in table2_emails
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

        # Map table2 by uid and by email
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

        # 3. Check operational_matches + scheduled_dates + match_evaluations for table2_uids
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

        # 4. Check match_evaluations / interview_appointments / reminders / users.hashed_password
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

        # Check reminders mentioning any of the 449 side_a names where a Stripe payment existed
        r_rem_t2 = await db.execute(
            text("""
                SELECT id, title, description, status, assigned_to, created_at
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
    asyncio.run(run_all())
