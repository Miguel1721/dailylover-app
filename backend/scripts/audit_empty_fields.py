import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal
from sqlalchemy import text

async def profile_stats():
    print("=== AUDITORÍA PROFUNDA DE CAMPOS VACÍOS EN DAILY LOVER ===")
    async with AsyncSessionLocal() as db:
        # Estadísticas globales en users y profiles
        res = await db.execute(text("""
            SELECT
                count(*) as total_valid_users,
                count(p.user_id) as users_with_profile_row,
                count(*) FILTER (WHERE p.age IS NULL OR p.age = 0) as missing_age,
                count(*) FILTER (WHERE p.city IS NULL OR p.city = '' OR p.city = 'No especificada') as missing_city,
                count(*) FILTER (WHERE p.gender IS NULL OR p.gender = '' OR p.gender = 'No especificado') as missing_gender,
                count(*) FILTER (WHERE p.estatura IS NULL OR p.estatura = '') as missing_estatura,
                count(*) FILTER (WHERE p.bio_notes IS NULL OR length(trim(p.bio_notes)) < 20) as missing_bio_notes,
                count(*) FILTER (WHERE p.search_preferences IS NULL OR p.search_preferences::text = '{}') as missing_search_prefs,
                count(*) FILTER (WHERE p.plan_tier IS NOT NULL AND p.plan_tier != '') as has_plan_tier,
                count(*) FILTER (WHERE u.phone IS NULL OR u.phone = '') as missing_phone,
                count(*) FILTER (WHERE u.email IS NULL OR u.email = '') as missing_email,
                count(*) FILTER (WHERE u.crm_id IS NULL OR u.crm_id = '' OR u.crm_id = 'None') as missing_crm_id
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.merged_into_id IS NULL
              AND u.name NOT ILIKE 'Cliente CRM%'
              AND u.name NOT ILIKE 'Sin nombre%'
              AND u.name NOT ILIKE '%unknown%'
              AND u.name !~* '^(no match|not approved|no hay|aprobado|refund|descalificado|trouble|unknown|cliente)'
        """))
        row = dict(res.fetchone()._mapping)
        for k, v in row.items():
            pct = (v / row['total_valid_users'] * 100) if row['total_valid_users'] else 0
            print(f"  - {k}: {v:,} ({pct:.1f}%)")

        # Usuarios con plan activo o contratado y su nivel de completitud
        print("\n=== CLIENTES CON PLAN O PRIORITARIOS ===")
        res_plan = await db.execute(text("""
            SELECT
                count(*) as total_with_plan,
                count(*) FILTER (WHERE p.age IS NULL OR p.age = 0) as plan_missing_age,
                count(*) FILTER (WHERE p.city IS NULL OR p.city = '' OR p.city = 'No especificada') as plan_missing_city,
                count(*) FILTER (WHERE p.bio_notes IS NULL OR length(trim(p.bio_notes)) < 20) as plan_missing_bio_notes,
                count(*) FILTER (WHERE p.search_preferences IS NULL OR p.search_preferences::text = '{}') as plan_missing_search_prefs
            FROM users u
            JOIN profiles p ON p.user_id = u.id
            WHERE p.plan_tier IS NOT NULL AND p.plan_tier != ''
        """))
        row_plan = dict(res_plan.fetchone()._mapping)
        for k, v in row_plan.items():
            pct = (v / row_plan['total_with_plan'] * 100) if row_plan['total_with_plan'] else 0
            print(f"  - {k}: {v:,} ({pct:.1f}%)")

        # Dónde hay datos guardados que no se hayan extraído:
        print("\n=== FUENTES DE DATOS POTENCIALES ===")
        # 1. ¿Cuántos usuarios tienen eventos en webhook_events_raw?
        res_wh = await db.execute(text("SELECT count(*) FROM webhook_events_raw WHERE payload IS NOT NULL"))
        wh_count = res_wh.scalar() or 0
        print(f"  - Registros con payloads crudos en webhook_events_raw: {wh_count:,}")

        # 2. ¿Cuántos tienen datos en operational_matches que podrían vincularse?
        res_op = await db.execute(text("""
            SELECT count(DISTINCT lower(trim(person_a))) + count(DISTINCT lower(trim(person_b))) FROM operational_matches
        """))
        print(f"  - Nombres únicos en operational_matches: {res_op.scalar() or 0:,}")

        # 3. ¿Cuántos tienen datos en priority_client_tracking?
        res_pct = await db.execute(text("SELECT count(*) FROM priority_client_tracking"))
        print(f"  - Registros en priority_client_tracking: {res_pct.scalar() or 0:,}")

        # 4. Distribución de completitud: cuántos usuarios tienen perfil completo para ser candidatos viables
        res_eligibility = await db.execute(text("""
            SELECT
                count(*) FILTER (
                    WHERE p.gender IN ('Hombre', 'Mujer')
                      AND p.city IS NOT NULL AND p.city NOT IN ('', 'No especificada')
                      AND p.age IS NOT NULL AND p.age >= 18
                      AND p.bio_notes IS NOT NULL AND length(trim(p.bio_notes)) >= 30
                ) as fully_eligible_candidates,
                count(*) FILTER (
                    WHERE p.gender IN ('Hombre', 'Mujer')
                      AND p.city IS NOT NULL AND p.city NOT IN ('', 'No especificada')
                      AND p.age IS NOT NULL AND p.age >= 18
                ) as basic_demographics_complete,
                count(*) FILTER (
                    WHERE p.age IS NULL OR p.city IS NULL OR p.city IN ('', 'No especificada') OR p.gender NOT IN ('Hombre', 'Mujer')
                ) as blocked_critical_incomplete
            FROM users u
            JOIN profiles p ON p.user_id = u.id
            WHERE u.merged_into_id IS NULL
              AND u.name NOT ILIKE 'Cliente CRM%'
              AND u.name NOT ILIKE 'Sin nombre%'
              AND u.name !~* '^(no match|not approved|no hay|aprobado|refund|descalificado|trouble|unknown|cliente)'
        """))
        row_elig = dict(res_eligibility.fetchone()._mapping)
        print("\n=== DISTRIBUCIÓN DE ELEGIBILIDAD ===")
        for k, v in row_elig.items():
            pct = (v / row['total_valid_users'] * 100) if row['total_valid_users'] else 0
            print(f"  - {k}: {v:,} ({pct:.1f}%)")

if __name__ == "__main__":
    asyncio.run(profile_stats())
