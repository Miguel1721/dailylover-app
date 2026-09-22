import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def check_crm_dummies():
    async with AsyncSessionLocal() as db:
        crm_dummies = (await db.execute(text("SELECT COUNT(*) FROM users WHERE name ILIKE 'Cliente CRM%';"))).scalar()
        print(f"Usuarios con nombre 'Cliente CRM...': {crm_dummies}")
        
        test_users = (await db.execute(text("SELECT COUNT(*) FROM users WHERE name ILIKE '%test%';"))).scalar()
        print(f"Usuarios con 'test' en el nombre: {test_users}")
        
        null_names = (await db.execute(text("SELECT COUNT(*) FROM users WHERE name IS NULL OR name = '';"))).scalar()
        print(f"Usuarios sin nombre (NULL/vacío): {null_names}")

        real_named_with_notes = (await db.execute(text("""
            SELECT COUNT(*) 
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.name NOT ILIKE 'Cliente CRM%'
              AND u.name NOT ILIKE '%test%'
              AND LENGTH(COALESCE(p.bio_notes, '')) > 40;
        """))).scalar()
        print(f"\nClientes y Candidatos REALES (Nombre real + Entrevista/Notas clínicas): {real_named_with_notes}")

        real_any_notes = (await db.execute(text("""
            SELECT COUNT(*) 
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.name NOT ILIKE 'Cliente CRM%'
              AND u.name NOT ILIKE '%test%';
        """))).scalar()
        print(f"Personas reales totales registradas (con o sin entrevista): {real_any_notes}")

if __name__ == '__main__':
    asyncio.run(check_crm_dummies())
