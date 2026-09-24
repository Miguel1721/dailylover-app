import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as db:
        groups = {
            'Sofi -> Silva (Silvi)': ['SOFI ARIAS', 'SOFI', 'SOFIA ARIAS', 'MATCHES SOFI'],
            'Aleja -> Jenn': ['ALEJA', 'MATCHES ALEJA'],
            'Lau -> Isa': ['LAU', 'MATCHES LAU'],
            'Maripaz/MariB/MariS -> Ana': ['MARI PAZ', 'MARIPAZ', 'MARI SARMIENTO', 'MARI B', 'MARIB'],
            'Manu -> Teffy (Steffy)': ['MANU', 'MATCHES MANU']
        }
        
        print('\n=== CONTEO DE PERFILES POR GRUPO ===')
        for grp, names in groups.items():
            names_in = ', '.join([f"'{n}'" for n in names])
            q = f"""
                SELECT count(*), 
                       min(u.created_at), max(u.created_at),
                       count(p.bio_notes) FILTER (WHERE p.bio_notes IS NOT NULL AND p.bio_notes != '')
                FROM profiles p
                JOIN users u ON u.id = p.user_id
                WHERE UPPER(TRIM(p.responsable)) IN ({names_in})
            """
            res = await db.execute(text(q))
            r = res.fetchone()
            print(f">> {grp}: Total Perfiles: {r[0]} | Con bio_notes: {r[3]} | Fechas de registro: {r[1]} a {r[2]}")

        print('\n=== ESTADOS DE MATCHES OPERATIVOS POR RETIRADA ===')
        for grp, names in groups.items():
            names_in = ', '.join([f"'{n}'" for n in names])
            q = f"""
                SELECT COALESCE(status, '(Sin status)'), approved_by_maria, count(*) 
                FROM operational_matches 
                WHERE UPPER(TRIM(psychologist_name)) IN ({names_in})
                GROUP BY status, approved_by_maria
                ORDER BY count(*) DESC
            """
            res = await db.execute(text(q))
            rows = res.fetchall()
            print(f"\n>> {grp} (Total matches: {sum(r[2] for r in rows)}):")
            for r in rows[:8]:
                print(f"   - Status: '{r[0]}' | Aprobado María: {r[1]} | Cantidad: {r[2]}")

if __name__ == '__main__':
    asyncio.run(check())
