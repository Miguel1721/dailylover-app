import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def analyze():
    async with AsyncSessionLocal() as db:
        print("=== 1. ANALISIS DETALLADO DE 'Cliente CRM%' (559 registros) ===")
        # Check notes length
        notes_stat = await db.execute(text("""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE p.bio_notes IS NOT NULL AND LENGTH(TRIM(p.bio_notes)) > 0) as with_any_notes,
                COUNT(*) FILTER (WHERE p.bio_notes IS NOT NULL AND LENGTH(TRIM(p.bio_notes)) > 40) as with_real_notes,
                COUNT(*) FILTER (WHERE u.email IS NOT NULL AND u.email != '') as with_email,
                COUNT(*) FILTER (WHERE p.plan_tier IS NOT NULL) as with_tier
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.name ILIKE 'Cliente CRM%';
        """))
        row = notes_stat.fetchone()
        print(f"Total: {row[0]}")
        print(f"Con alguna nota: {row[1]}")
        print(f"Con notas > 40 chars: {row[2]}")
        print(f"Con email: {row[3]}")
        print(f"Con plan_tier: {row[4]}")

        # Check the 13 that have notes
        if row[1] > 0:
            print("\nNotas de los 'Cliente CRM%' que sí tienen alguna nota:")
            notes_samples = await db.execute(text("""
                SELECT u.id, u.name, u.email, p.bio_notes
                FROM users u
                JOIN profiles p ON p.user_id = u.id
                WHERE u.name ILIKE 'Cliente CRM%' AND LENGTH(TRIM(COALESCE(p.bio_notes, ''))) > 0;
            """))
            for ns in notes_samples.fetchall():
                print(f"  UID {ns[0]} | {ns[1]} | {ns[2]} | Nota ({len(ns[3])}c): {ns[3][:80]}...")

        # Columns of stripe_payments
        col_res = await db.execute(text("""
            SELECT column_name FROM information_schema.columns WHERE table_name = 'stripe_payments';
        """))
        cols = [c[0] for c in col_res.fetchall()]
        print(f"\nColumnas de stripe_payments: {cols}")

        # Check the 23 Stripe payments
        stripe_stat = await db.execute(text("""
            SELECT sp.id, sp.user_id, u.name, u.email, sp.amount, sp.created_at
            FROM stripe_payments sp
            JOIN users u ON u.id = sp.user_id
            WHERE u.name ILIKE 'Cliente CRM%';
        """))
        print("\nPagos Stripe vinculados a 'Cliente CRM%':")
        payments = stripe_stat.fetchall()
        for p in payments:
            print(f"  Pago {p[0]} | UID {p[1]} ({p[2]}) | Email: {p[3]} | Monto: {p[4]} | Fecha: {p[5]}")

        # Check the 3 operational matches
        op_stat = await db.execute(text("""
            SELECT om.id, om.user_id_a, u1.name as name_a, om.user_id_b, u2.name as name_b, om.status, om.created_at
            FROM operational_matches om
            JOIN users u1 ON u1.id = om.user_id_a
            LEFT JOIN users u2 ON u2.id = om.user_id_b
            WHERE u1.name ILIKE 'Cliente CRM%' OR u2.name ILIKE 'Cliente CRM%';
        """))
        print("\nOperational matches vinculados a 'Cliente CRM%':")
        for m in op_stat.fetchall():
            print(f"  Match {m[0]} | User A: {m[1]} ({m[2]}) | User B: {m[3]} ({m[4]}) | Estado: {m[5]} | Fecha: {m[6]}")

        print("\n=== 2. ANALISIS DE LEADS Y REGISTROS WEB SIN ENTREVISTA ===")
        leads_stat = await db.execute(text("""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE p.bio_notes IS NULL OR TRIM(p.bio_notes) = '') as zero_notes,
                COUNT(*) FILTER (WHERE LENGTH(TRIM(COALESCE(p.bio_notes, ''))) BETWEEN 1 AND 40) as short_notes,
                COUNT(*) FILTER (WHERE p.plan_tier IS NOT NULL) as with_tier,
                COUNT(*) FILTER (WHERE u.email IS NOT NULL AND u.email != '') as with_email,
                COUNT(*) FILTER (WHERE p.lifestyle->>'availability_status' = 'ACTIVO') as activo_status
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.name NOT ILIKE 'Cliente CRM%'
              AND (p.bio_notes IS NULL OR LENGTH(TRIM(p.bio_notes)) <= 40);
        """))
        lrow = leads_stat.fetchone()
        print(f"Total Leads sin entrevista: {lrow[0]}")
        print(f"  Notas totalmente vacías (NULL/''): {lrow[1]}")
        print(f"  Notas cortas (1-40 chars): {lrow[2]}")
        print(f"  Con plan_tier asignado: {lrow[3]}")
        print(f"  Con email: {lrow[4]}")
        print(f"  Con availability_status = 'ACTIVO': {lrow[5]}")

        # Check sample of short notes
        print("\nMuestra de notas cortas (1-40 chars):")
        short_samples = await db.execute(text("""
            SELECT p.user_id, u.name, p.bio_notes
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.name NOT ILIKE 'Cliente CRM%'
              AND LENGTH(TRIM(COALESCE(p.bio_notes, ''))) BETWEEN 1 AND 40
            LIMIT 10;
        """))
        for s in short_samples.fetchall():
            print(f"  UID {s[0]} ({s[1]}): '{s[2]}'")

if __name__ == '__main__':
    asyncio.run(analyze())
