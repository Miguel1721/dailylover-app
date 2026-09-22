import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def test_transaction():
    async with AsyncSessionLocal() as db:
        # We start an explicit transaction and will rollback at the end
        try:
            print(">>> 1. Creando tablas de respaldo...")
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS archived_crm_placeholders_backup AS
                SELECT u.id as user_id, u.name, u.email, u.phone, u.client_code, u.created_at as user_created_at,
                       p.bio_notes, p.city, p.age, p.plan_tier, p.responsable, p.search_preferences, p.lifestyle
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                WHERE u.name ILIKE 'Cliente CRM%';
            """))

            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS archived_crm_payments_backup AS
                SELECT sp.* 
                FROM stripe_payments sp
                JOIN users u ON u.id = sp.user_id
                WHERE u.name ILIKE 'Cliente CRM%';
            """))

            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS archived_crm_matches_backup AS
                SELECT om.*
                FROM operational_matches om
                JOIN users u ON u.id = om.user_id_a
                WHERE u.name ILIKE 'Cliente CRM%';
            """))

            print(">>> 2. Verificando respaldos...")
            cnt_u_bk = (await db.execute(text("SELECT COUNT(*) FROM archived_crm_placeholders_backup;"))).scalar()
            cnt_p_bk = (await db.execute(text("SELECT COUNT(*) FROM archived_crm_payments_backup;"))).scalar()
            cnt_m_bk = (await db.execute(text("SELECT COUNT(*) FROM archived_crm_matches_backup;"))).scalar()
            print(f"  Backup CRM users/profiles: {cnt_u_bk}")
            print(f"  Backup CRM payments: {cnt_p_bk}")
            print(f"  Backup CRM matches: {cnt_m_bk}")

            print(">>> 3. Eliminando matches y usuarios CRM...")
            # Borrar los 3 matches
            del_m = await db.execute(text("""
                DELETE FROM operational_matches 
                WHERE user_id_a IN (SELECT id FROM users WHERE name ILIKE 'Cliente CRM%')
                   OR user_id_b IN (SELECT id FROM users WHERE name ILIKE 'Cliente CRM%');
            """))
            print(f"  Matches eliminados: {del_m.rowcount}")

            # Borrar profiles CRM
            del_p = await db.execute(text("""
                DELETE FROM profiles 
                WHERE user_id IN (SELECT id FROM users WHERE name ILIKE 'Cliente CRM%');
            """))
            print(f"  Profiles CRM eliminados: {del_p.rowcount}")

            # Borrar users CRM
            del_u = await db.execute(text("""
                DELETE FROM users 
                WHERE name ILIKE 'Cliente CRM%';
            """))
            print(f"  Users CRM eliminados: {del_u.rowcount}")

            print(">>> 4. Creando tabla leads_pendientes_entrevista...")
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS leads_pendientes_entrevista (
                    LIKE profiles INCLUDING ALL
                );
            """))

            print(">>> 5. Moviendo los 2.921 leads...")
            ins_l = await db.execute(text("""
                INSERT INTO leads_pendientes_entrevista
                SELECT * FROM profiles
                WHERE bio_notes IS NULL OR LENGTH(TRIM(bio_notes)) <= 40
                ON CONFLICT (user_id) DO NOTHING;
            """))
            print(f"  Leads insertados en leads_pendientes_entrevista: {ins_l.rowcount}")

            del_l = await db.execute(text("""
                DELETE FROM profiles
                WHERE user_id IN (SELECT user_id FROM leads_pendientes_entrevista);
            """))
            print(f"  Leads eliminados de profiles: {del_l.rowcount}")

            # Conteo resultante
            p_final = (await db.execute(text("SELECT COUNT(*) FROM profiles;"))).scalar()
            l_final = (await db.execute(text("SELECT COUNT(*) FROM leads_pendientes_entrevista;"))).scalar()
            u_final = (await db.execute(text("SELECT COUNT(*) FROM users;"))).scalar()

            print("\n>>> RESULTADOS DE LA PRUEBA:")
            print(f"  🟢 profiles (Pool de Matchmaking activo): {p_final}")
            print(f"  🟡 leads_pendientes_entrevista: {l_final}")
            print(f"  👤 users: {u_final}")

            # Rollback para no aplicar aún hasta estar seguros
            print("\n>>> Haciendo ROLLBACK (prueba segura sin alterar BD)...")
            await db.rollback()
            print(">>> ROLLBACK completado exitosamente. La BD sigue intacta.")

        except Exception as e:
            await db.rollback()
            print(f"❌ ERROR durante la prueba: {e}")
            raise e

if __name__ == '__main__':
    asyncio.run(test_transaction())
