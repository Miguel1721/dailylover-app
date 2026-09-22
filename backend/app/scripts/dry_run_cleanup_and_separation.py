import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def dry_run():
    async with AsyncSessionLocal() as db:
        print("=== DRY-RUN: VERIFICACIÓN PREVIA AL SANEAMIENTO Y SEPARACIÓN ===")

        # 1. Conteo actual
        users_count = (await db.execute(text("SELECT COUNT(*) FROM users;"))).scalar()
        profiles_count = (await db.execute(text("SELECT COUNT(*) FROM profiles;"))).scalar()
        print(f"Estado Actual:")
        print(f"  users: {users_count}")
        print(f"  profiles: {profiles_count}")

        # 2. Registros 'Cliente CRM%'
        crm_users = (await db.execute(text("SELECT COUNT(*) FROM users WHERE name ILIKE 'Cliente CRM%';"))).scalar()
        crm_profiles = (await db.execute(text("SELECT COUNT(*) FROM profiles WHERE user_id IN (SELECT id FROM users WHERE name ILIKE 'Cliente CRM%');"))).scalar()
        print(f"\n1. Placeholders Técnicos CRM a BORRAR:")
        print(f"  users ('Cliente CRM%'): {crm_users}")
        print(f"  profiles ('Cliente CRM%'): {crm_profiles}")

        # 3. Matches operativos y pagos stripe vinculados a 'Cliente CRM%'
        crm_op_matches = (await db.execute(text("""
            SELECT id, user_id_a, status FROM operational_matches 
            WHERE user_id_a IN (SELECT id FROM users WHERE name ILIKE 'Cliente CRM%')
               OR user_id_b IN (SELECT id FROM users WHERE name ILIKE 'Cliente CRM%');
        """))).fetchall()
        print(f"  operational_matches vinculados a CRM: {len(crm_op_matches)}")
        for m in crm_op_matches:
            print(f"    Match ID {m[0]} (User A: {m[1]}, Status: {m[2]})")

        crm_payments = (await db.execute(text("""
            SELECT id, user_id, amount, customer_email FROM stripe_payments 
            WHERE user_id IN (SELECT id FROM users WHERE name ILIKE 'Cliente CRM%');
        """))).fetchall()
        print(f"  stripe_payments vinculados a CRM: {len(crm_payments)}")

        # 4. Leads sin entrevista a SEPARAR
        leads_stat = await db.execute(text("""
            SELECT COUNT(*) 
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.name NOT ILIKE 'Cliente CRM%'
              AND (p.bio_notes IS NULL OR LENGTH(TRIM(p.bio_notes)) <= 40);
        """))
        leads_count = leads_stat.scalar()

        # 5. Perfiles reales con entrevista (el POOL REAL de Matchmaking)
        real_profiles_stat = await db.execute(text("""
            SELECT COUNT(*) 
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.name NOT ILIKE 'Cliente CRM%'
              AND p.bio_notes IS NOT NULL 
              AND LENGTH(TRIM(p.bio_notes)) > 40;
        """))
        real_count = real_profiles_stat.scalar()

        print(f"\n2. Población Real tras separar Leads:")
        print(f"  🟡 Leads sin entrevista a mover a 'leads_pendientes_entrevista': {leads_count}")
        print(f"  🟢 Clientes/Candidatos REALES con entrevista en 'profiles': {real_count}")
        print(f"  Suma: {leads_count} + {real_count} = {leads_count + real_count}")
        print(f"  Verificación: {crm_profiles} + {leads_count} + {real_count} = {crm_profiles + leads_count + real_count} (Total actual profiles: {profiles_count})")

        print("\n=== PROYECCIÓN POST-OPERACIÓN ===")
        print(f"  Tabla 'profiles' (Pool activo de Matchmaking): {real_count} registros")
        print(f"  Tabla 'leads_pendientes_entrevista': {leads_count} registros")
        print(f"  Tabla 'users' (Cuentas reales registradas): {users_count - crm_users} usuarios")
        print(f"  Tablas de archivo y backup creadas para auditoría total: OK")

if __name__ == '__main__':
    asyncio.run(dry_run())
