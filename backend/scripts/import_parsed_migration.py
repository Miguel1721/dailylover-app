import asyncio
import json
import os
import sys

sys.path.insert(0, '/app')
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')

from sqlalchemy import text
from app.database import AsyncSessionLocal

JSON_FILE = '/home/ubuntu/dailylover/backend/scratch/parsed_migration_data.json'
if not os.path.exists(JSON_FILE):
    JSON_FILE = '/app/scratch/parsed_migration_data.json'
if not os.path.exists(JSON_FILE):
    JSON_FILE = 'scratch/parsed_migration_data.json'

async def import_data():
    if not os.path.exists(JSON_FILE):
        print(f"File {JSON_FILE} not found!")
        return

    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    op_matches = data.get("operational_matches", [])
    confirmations = data.get("confirmations", [])
    calendar_dates = data.get("calendar_dates", [])
    history_events = data.get("history_events", [])

    print(f"Loaded {len(op_matches)} matches, {len(confirmations)} confirmations, {len(calendar_dates)} calendar dates, {len(history_events)} history events.")

    async with AsyncSessionLocal() as db:
        print("\n--- 1. Adjusting column types to TEXT and Clearing tables (Idempotent Reset) ---")
        await db.execute(text("ALTER TABLE operational_matches ALTER COLUMN city TYPE TEXT;"))
        await db.execute(text("ALTER TABLE operational_matches ALTER COLUMN pref TYPE TEXT;"))
        await db.execute(text("ALTER TABLE operational_matches ALTER COLUMN plan_tier TYPE TEXT;"))
        await db.execute(text("ALTER TABLE operational_matches ALTER COLUMN status TYPE TEXT;"))
        await db.execute(text("ALTER TABLE match_confirmations ALTER COLUMN pause_reason TYPE TEXT;"))
        await db.execute(text("ALTER TABLE match_confirmations ALTER COLUMN stage TYPE TEXT;"))
        await db.execute(text("ALTER TABLE match_confirmations ALTER COLUMN person_a_confirmation TYPE TEXT;"))
        await db.execute(text("ALTER TABLE match_confirmations ALTER COLUMN person_b_confirmation TYPE TEXT;"))
        await db.execute(text("ALTER TABLE scheduled_dates ALTER COLUMN venue TYPE TEXT;"))
        await db.execute(text("ALTER TABLE scheduled_dates ALTER COLUMN date_time TYPE TEXT;"))
        await db.execute(text("TRUNCATE TABLE person_history, scheduled_dates, match_confirmations, operational_matches RESTART IDENTITY CASCADE;"))
        await db.commit()

        print("\n--- 2. Ingesting Operational Matches (Batch Size: 200) ---")
        batch_size = 200
        for i in range(0, len(op_matches), batch_size):
            batch = op_matches[i:i+batch_size]
            for m in batch:
                await db.execute(text("""
                    INSERT INTO operational_matches (
                        person_a, person_b, psychologist_name, city, pref, plan_tier,
                        status, approved_by_maria, observations, slot_number, created_at, updated_at
                    ) VALUES (
                        :pA, :pB, :psyc, :city, :pref, :plan,
                        :status, :approved, :obs, :slot, NOW(), NOW()
                    )
                """), {
                    "pA": m["person_a"],
                    "pB": m["person_b"],
                    "psyc": m["psychologist_name"],
                    "city": m["city"],
                    "pref": m["pref"],
                    "plan": m["plan_tier"],
                    "status": m["status"],
                    "approved": m["approved_by_maria"],
                    "obs": m["observations"],
                    "slot": m["slot_number"]
                })
            await db.commit()
            print(f"  Inserted matches {i} to {min(i+batch_size, len(op_matches))}")

        print("\n--- 3. Ingesting Confirmations (Pendientes, Pausas, Trouble) ---")
        # Fetch match IDs to link if possible, or insert
        for conf in confirmations:
            # Try to find a match_id for person_a
            m_res = await db.execute(text("""
                SELECT id FROM operational_matches 
                WHERE LOWER(person_a) = LOWER(:pA)
                LIMIT 1
            """), {"pA": conf["person_a"]})
            match_id = m_res.scalar()

            if not match_id:
                # Create a placeholder match if not existing
                ins_m = await db.execute(text("""
                    INSERT INTO operational_matches (person_a, person_b, psychologist_name, city, pref, plan_tier, status, approved_by_maria, slot_number, created_at, updated_at)
                    VALUES (:pA, :pB, 'SILVI', 'Bogotá', 'hetero', 'Estándar 65k (2 citas)', 'APROBADO', true, 1, NOW(), NOW())
                    RETURNING id
                """), {"pA": conf["person_a"], "pB": conf["person_b"]})
                match_id = ins_m.scalar()

            await db.execute(text("""
                INSERT INTO match_confirmations (
                    match_id, person_a_confirmation, person_b_confirmation, stage, pause_reason, created_at, updated_at
                ) VALUES (
                    :mid, :cA, :cB, :stg, :reason, NOW(), NOW()
                )
            """), {
                "mid": match_id,
                "cA": conf["person_a_confirmation"],
                "cB": conf["person_b_confirmation"],
                "stg": conf["stage"],
                "reason": conf.get("pause_reason")
            })
        await db.commit()
        print(f"  Inserted {len(confirmations)} confirmations.")

        print("\n--- 4. Ingesting Scheduled Dates (Calendario) ---")
        for cal in calendar_dates:
            m_res = await db.execute(text("""
                SELECT id FROM operational_matches 
                WHERE LOWER(person_a) = LOWER(:pA)
                LIMIT 1
            """), {"pA": cal["person_a"]})
            match_id = m_res.scalar()

            await db.execute(text("""
                INSERT INTO scheduled_dates (
                    match_id, person_a, person_b, date_time, venue, city, reservation_name, had_date, feedback, reschedule, created_at, updated_at
                ) VALUES (
                    :mid, :pA, :pB, :dt, :ven, :city, 'María Paula Salinas', :had, '', false, NOW(), NOW()
                )
            """), {
                "mid": match_id,
                "pA": cal["person_a"],
                "pB": cal["person_b"],
                "dt": cal["date_time"],
                "ven": cal["venue"],
                "city": cal["city"],
                "had": cal["had_date"]
            })
        await db.commit()
        print(f"  Inserted {len(calendar_dates)} scheduled dates.")

        print("\n--- 5. Ingesting History Events (Historial) ---")
        for h in history_events:
            await db.execute(text("""
                INSERT INTO person_history (person_name, event_type, details, created_at)
                VALUES (:name, :evt, :det, NOW())
            """), {
                "name": h["person_name"],
                "evt": h["event_type"],
                "det": h["details"]
            })
        await db.commit()
        print(f"  Inserted {len(history_events)} history events.")

        print("\n=== MIGRATION COMPLETED SUCCESSFULLY ===")

if __name__ == '__main__':
    asyncio.run(import_data())
