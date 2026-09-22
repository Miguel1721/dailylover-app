import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def execute_cleanup_and_separation():
    async with AsyncSessionLocal() as db:
        print("================================================================================")
        print("  SANEAMIENTO Y SEPARACIÓN DEFINITIVA: CRM PLACEHOLDERS & LEADS SIN ENTREVISTA  ")
        print("================================================================================\n")

        # --- FASE 1: RESPALDO PREVENTIVO EN TABLAS DE ARCHIVO ---
        print(">>> 1. Creando tablas de respaldo preventivo...")
        
        await db.execute(text("DROP TABLE IF EXISTS archived_crm_placeholders_backup CASCADE;"))
        await db.execute(text("DROP TABLE IF EXISTS archived_crm_payments_backup CASCADE;"))
        await db.execute(text("DROP TABLE IF EXISTS archived_crm_matches_backup CASCADE;"))
        await db.execute(text("DROP TABLE IF EXISTS leads_pendientes_entrevista CASCADE;"))

        await db.execute(text("""
            CREATE TABLE archived_crm_placeholders_backup AS
            SELECT u.id as user_id, u.name, u.email, u.phone, u.client_code, u.created_at as user_created_at,
                   p.bio_notes, p.city, p.age, p.plan_tier, p.responsable, p.search_preferences, p.lifestyle
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.name ILIKE 'Cliente CRM%';
        """))

        await db.execute(text("""
            CREATE TABLE archived_crm_payments_backup AS
            SELECT sp.* 
            FROM stripe_payments sp
            JOIN users u ON u.id = sp.user_id
            WHERE u.name ILIKE 'Cliente CRM%';
        """))

        await db.execute(text("""
            CREATE TABLE archived_crm_matches_backup AS
            SELECT om.*
            FROM operational_matches om
            JOIN users u ON u.id = om.user_id_a
            WHERE u.name ILIKE 'Cliente CRM%';
        """))

        cnt_u_bk = (await db.execute(text("SELECT COUNT(*) FROM archived_crm_placeholders_backup;"))).scalar()
        cnt_p_bk = (await db.execute(text("SELECT COUNT(*) FROM archived_crm_payments_backup;"))).scalar()
        cnt_m_bk = (await db.execute(text("SELECT COUNT(*) FROM archived_crm_matches_backup;"))).scalar()
        print(f"  ✓ Respaldo creado: {cnt_u_bk} usuarios/perfiles CRM en 'archived_crm_placeholders_backup'")
        print(f"  ✓ Respaldo creado: {cnt_p_bk} pagos Stripe en 'archived_crm_payments_backup'")
        print(f"  ✓ Respaldo creado: {cnt_m_bk} matches en 'archived_crm_matches_backup'")

        # --- FASE 2: BORRADO DE LOS 559 PLACEHOLDERS DEL CRM ---
        print("\n>>> 2. Eliminando registros basura de 'Cliente CRM%'...")
        
        # 2.1 Borrar los 3 matches huérfanos
        del_m = await db.execute(text("""
            DELETE FROM operational_matches 
            WHERE user_id_a IN (SELECT user_id FROM archived_crm_placeholders_backup)
               OR user_id_b IN (SELECT user_id FROM archived_crm_placeholders_backup);
        """))
        print(f"  ✓ {del_m.rowcount} operational_matches de prueba eliminados")

        # 2.2 Desvincular stripe_payments si existieran
        await db.execute(text("""
            UPDATE stripe_payments 
            SET user_id = NULL 
            WHERE user_id IN (SELECT user_id FROM archived_crm_placeholders_backup);
        """))

        # 2.3 Borrar perfiles
        del_p = await db.execute(text("""
            DELETE FROM profiles 
            WHERE user_id IN (SELECT user_id FROM archived_crm_placeholders_backup);
        """))
        print(f"  ✓ {del_p.rowcount} profiles 'Cliente CRM%' eliminados")

        # 2.4 Borrar usuarios
        del_u = await db.execute(text("""
            DELETE FROM users 
            WHERE id IN (SELECT user_id FROM archived_crm_placeholders_backup);
        """))
        print(f"  ✓ {del_u.rowcount} users 'Cliente CRM%' eliminados")

        # --- FASE 3: CREACIÓN DE TABLA Y SEPARACIÓN DE LOS 2.921 LEADS ---
        print("\n>>> 3. Creando tabla y separando leads sin entrevista...")
        
        await db.execute(text("""
            CREATE TABLE leads_pendientes_entrevista (
                LIKE profiles INCLUDING ALL
            );
        """))

        ins_l = await db.execute(text("""
            INSERT INTO leads_pendientes_entrevista
            SELECT * FROM profiles
            WHERE bio_notes IS NULL OR LENGTH(TRIM(bio_notes)) <= 40
            ON CONFLICT (user_id) DO NOTHING;
        """))
        print(f"  ✓ {ins_l.rowcount} leads copiados a 'leads_pendientes_entrevista'")

        del_l = await db.execute(text("""
            DELETE FROM profiles
            WHERE user_id IN (SELECT user_id FROM leads_pendientes_entrevista);
        """))
        print(f"  ✓ {del_l.rowcount} leads retirados de 'profiles' (ahora exclusivo para pool de matching)")

        # --- FASE 4: TRIGGER AUTOMÁTICO DE GRADUACIÓN ---
        print("\n>>> 4. Instalando trigger de graduación de lead a perfil entrevistado...")
        await db.execute(text("""
            CREATE OR REPLACE FUNCTION fn_promote_lead_on_profile_insert()
            RETURNS TRIGGER AS $$
            BEGIN
                DELETE FROM leads_pendientes_entrevista WHERE user_id = NEW.user_id;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """))

        await db.execute(text("DROP TRIGGER IF EXISTS trg_promote_lead_on_profile_insert ON profiles;"))

        await db.execute(text("""
            CREATE TRIGGER trg_promote_lead_on_profile_insert
            AFTER INSERT ON profiles
            FOR EACH ROW
            EXECUTE FUNCTION fn_promote_lead_on_profile_insert();
        """))
        print("  ✓ Trigger 'trg_promote_lead_on_profile_insert' instalado exitosamente.")

        # --- FASE 5: VISTA ADMINISTRATIVA UNIFICADA ---
        print("\n>>> 5. Creando vista unificada para consulta global...")
        await db.execute(text("""
            CREATE OR REPLACE VIEW v_todos_los_usuarios_con_estado AS
            SELECT 
                u.id as user_id,
                u.name,
                u.email,
                u.phone,
                u.client_code,
                u.created_at,
                CASE 
                    WHEN p.user_id IS NOT NULL THEN 'CLIENTE_ENTREVISTADO_ACTIVO'
                    WHEN l.user_id IS NOT NULL THEN 'LEAD_PENDIENTE_ENTREVISTA'
                    ELSE 'USUARIO_REGISTRADO'
                END as estado_sistema,
                COALESCE(p.city, l.city) as city,
                COALESCE(p.age, l.age) as age,
                COALESCE(p.plan_tier, l.plan_tier) as plan_tier,
                COALESCE(p.responsable, l.responsable) as responsable,
                p.bio_notes as notas_clinicas
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            LEFT JOIN leads_pendientes_entrevista l ON l.user_id = u.id;
        """))
        print("  ✓ Vista 'v_todos_los_usuarios_con_estado' creada exitosamente.")

        # Confirmar transacción
        await db.commit()
        print("\n>>> ¡TRANSACCIÓN CONFIRMADA Y APLICADA CON ÉXITO! <<<\n")

        # --- FASE 6: AUDITORÍA DE RESULTADOS FINALES ---
        p_count = (await db.execute(text("SELECT COUNT(*) FROM profiles;"))).scalar()
        l_count = (await db.execute(text("SELECT COUNT(*) FROM leads_pendientes_entrevista;"))).scalar()
        u_count = (await db.execute(text("SELECT COUNT(*) FROM users;"))).scalar()
        crm_rem = (await db.execute(text("SELECT COUNT(*) FROM users WHERE name ILIKE 'Cliente CRM%';"))).scalar()

        print("================================================================================")
        print("                         ESTADO FINAL DE LA BASE DE DATOS                       ")
        print("================================================================================")
        print(f"  🟢 profiles (Pool Activo de Matchmaking - Personas con Entrevista): {p_count}")
        print(f"  🟡 leads_pendientes_entrevista (Leads y registros web a entrevistar): {l_count}")
        print(f"  👤 users (Cuentas reales registradas en el sistema):                {u_count}")
        print(f"  ⚪ Placeholders 'Cliente CRM%' restantes en la base de datos:        {crm_rem}")
        print(f"  📦 Copia de respaldo disponible en: archived_crm_placeholders_backup")
        print("================================================================================\n")

if __name__ == '__main__':
    asyncio.run(execute_cleanup_and_separation())
