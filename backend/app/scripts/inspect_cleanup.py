import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def inspect_deletion_and_separation():
    async with AsyncSessionLocal() as db:
        # 1. Inspect the 559 "Cliente CRM%" rows
        res_crm = await db.execute(text("""
            SELECT u.id, u.name, u.email
            FROM users u
            WHERE u.name ILIKE 'Cliente CRM%'
            LIMIT 5;
        """))
        print("Sample Cliente CRM rows:")
        for r in res_crm.fetchall():
            print(f"  UID {r[0]} | {r[1]} | {r[2]}")

        # Check foreign keys pointing to users / profiles for these 559
        res_fks = await db.execute(text("""
            SELECT 
                (SELECT COUNT(*) FROM historical_matches WHERE client_user_id IN (SELECT id FROM users WHERE name ILIKE 'Cliente CRM%')) as hist_client,
                (SELECT COUNT(*) FROM historical_matches WHERE candidate_user_id IN (SELECT id FROM users WHERE name ILIKE 'Cliente CRM%')) as hist_cand,
                (SELECT COUNT(*) FROM scheduled_dates WHERE client_id IN (SELECT id FROM users WHERE name ILIKE 'Cliente CRM%')) as sched_client,
                (SELECT COUNT(*) FROM scheduled_dates WHERE match_id IN (SELECT id FROM users WHERE name ILIKE 'Cliente CRM%')) as sched_match,
                (SELECT COUNT(*) FROM client_notes WHERE client_id IN (SELECT id FROM users WHERE name ILIKE 'Cliente CRM%')) as notes_count,
                (SELECT COUNT(*) FROM cs_novedades WHERE client_id IN (SELECT id FROM users WHERE name ILIKE 'Cliente CRM%')) as cs_count;
        """))
        fk_row = res_fks.fetchone()
        print(f"\nFK references for 'Cliente CRM%':")
        print(f"  historical_matches (client): {fk_row[0]}")
        print(f"  historical_matches (candidate): {fk_row[1]}")
        print(f"  scheduled_dates (client): {fk_row[2]}")
        print(f"  scheduled_dates (match): {fk_row[3]}")
        print(f"  client_notes: {fk_row[4]}")
        print(f"  cs_novedades: {fk_row[5]}")

        # 2. Inspect the 2,921 leads without interview
        res_leads = await db.execute(text("""
            SELECT COUNT(*) 
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.name NOT ILIKE 'Cliente CRM%'
              AND (p.bio_notes IS NULL OR LENGTH(TRIM(p.bio_notes)) <= 40);
        """))
        leads_count = res_leads.scalar()
        print(f"\nTotal Leads sin entrevista (bio_notes <= 40 chars): {leads_count}")

        # Check what tables exist in admin or if any table holds leads
        res_tables = await db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name ILIKE '%lead%';
        """))
        lead_tables = [r[0] for r in res_tables.fetchall()]
        print(f"Existing lead tables: {lead_tables}")

if __name__ == '__main__':
    asyncio.run(inspect_deletion_and_separation())
