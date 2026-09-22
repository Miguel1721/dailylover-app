import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def analyze_profile_counts():
    async with AsyncSessionLocal() as db:
        # Total in users vs profiles
        u_count = (await db.execute(text("SELECT COUNT(*) FROM users;"))).scalar()
        p_count = (await db.execute(text("SELECT COUNT(*) FROM profiles;"))).scalar()
        l_count = (await db.execute(text("SELECT COUNT(*) FROM leads_pendientes_entrevista;"))).scalar()
        b_count = (await db.execute(text("SELECT COUNT(*) FROM archived_crm_placeholders_backup;"))).scalar()
        print(f"Total in table 'users': {u_count}")
        print(f"Total in table 'profiles' (Pool Activo Matchmaking): {p_count}")
        print(f"Total in table 'leads_pendientes_entrevista': {l_count}")
        print(f"Total in table 'archived_crm_placeholders_backup': {b_count}")

        # How many have bio_notes
        notes_count = (await db.execute(text("SELECT COUNT(*) FROM profiles WHERE LENGTH(COALESCE(bio_notes, '')) > 40;"))).scalar()
        print(f"Perfiles con notas clínicas reales (>40 chars): {notes_count}")

        # Empty or minimal bio_notes
        empty_notes = (await db.execute(text("SELECT COUNT(*) FROM profiles WHERE LENGTH(COALESCE(bio_notes, '')) <= 40;"))).scalar()
        print(f"Perfiles con notas vacías o mínimas (leads/incompletos): {empty_notes}")

        # Distribution of plan_tier
        print("\nDistribución de plan_tier en profiles:")
        tiers = (await db.execute(text("SELECT COALESCE(plan_tier, 'NULL / Sin plan'), COUNT(*) FROM profiles GROUP BY 1 ORDER BY 2 DESC;"))).fetchall()
        for t in tiers:
            print(f"  {t[0]}: {t[1]}")

        # Check clients with active payment or subscription
        paying = (await db.execute(text("SELECT COUNT(*) FROM profiles WHERE last_payment_amount IS NOT NULL OR stripe_customer_id IS NOT NULL;"))).scalar()
        print(f"\nPerfiles con historial de pago / stripe registrado: {paying}")

        # Sample some rows that have NO notes or NULL plan_tier
        print("\nMuestra de perfiles sin notas clínicas (¿Leads, registrados de la web, contactos importados?):")
        sample = (await db.execute(text("""
            SELECT p.user_id, u.name, u.email, p.city, p.plan_tier
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE LENGTH(COALESCE(p.bio_notes, '')) <= 40
            ORDER BY p.user_id DESC
            LIMIT 5;
        """))).fetchall()
        for s in sample:
            print(f"  UID {s[0]} | Name: '{s[1]}' | Email: {s[2]} | City: {s[3]} | Tier: {s[4]}")

if __name__ == '__main__':
    asyncio.run(analyze_profile_counts())
