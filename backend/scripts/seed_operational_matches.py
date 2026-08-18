import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def seed():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT count(*) FROM operational_matches"))
        count = res.scalar()
        if count == 0:
            print("Seeding initial operational matches for Silvi and team...")
            # Insert 3 slots for client 'Valeria Linero'
            for s in [1, 2, 3]:
                await db.execute(text("""
                    INSERT INTO operational_matches (
                        person_a, person_b, psychologist_name, city, pref, plan_tier,
                        status, approved_by_maria, observations, slot_number, created_at, updated_at
                    ) VALUES (
                        'Valeria Linero', :pb, 'SILVI', 'Bogotá', 'hetero', 'VIP 195k',
                        :st, :app, :obs, :slot, NOW(), NOW()
                    )
                """), {
                    "pb": "Carlos Mendoza" if s == 1 else ("David Botero" if s == 2 else None),
                    "st": "HECHO" if s == 1 else "Listo para match",
                    "app": False,
                    "obs": "Interesada en profesionales con afinidad deportiva y cultural" if s == 1 else "",
                    "slot": s
                })

            # Insert 3 slots for client 'Juan Pérez'
            for s in [1, 2, 3]:
                await db.execute(text("""
                    INSERT INTO operational_matches (
                        person_a, person_b, psychologist_name, city, pref, plan_tier,
                        status, approved_by_maria, observations, slot_number, created_at, updated_at
                    ) VALUES (
                        'Juan Pérez', :pb, 'SILVI', 'Medellín', 'hetero', 'Estándar 65k (2 citas)',
                        :st, :app, :obs, :slot, NOW(), NOW()
                    )
                """), {
                    "pb": "Mariana Gómez" if s == 1 else None,
                    "st": "Listo para match",
                    "app": False,
                    "obs": "",
                    "slot": s
                })

            await db.commit()
            print("Initial operational matches seeded successfully.")
        else:
            print(f"operational_matches already has {count} rows.")

if __name__ == '__main__':
    asyncio.run(seed())
