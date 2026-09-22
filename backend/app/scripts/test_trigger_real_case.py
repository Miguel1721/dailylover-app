import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def test_trigger():
    print("=" * 80)
    print("🧪 PRUEBA EMPÍRICA REAL DEL TRIGGER 'trg_promote_lead_on_profile_insert'")
    print("=" * 80)

    test_uid = 999998  # ID reservado para prueba

    async with AsyncSessionLocal() as db:
        try:
            # 0. Limpieza previa por si acaso
            await db.execute(text("DELETE FROM profiles WHERE user_id = :id;"), {"id": test_uid})
            await db.execute(text("DELETE FROM leads_pendientes_entrevista WHERE user_id = :id;"), {"id": test_uid})
            await db.execute(text("DELETE FROM users WHERE id = :id;"), {"id": test_uid})
            await db.commit()

            # 1. Crear usuario test
            print(f"\n1. Creando usuario de prueba (UID {test_uid})...")
            await db.execute(text("""
                INSERT INTO users (id, phone, name, email, created_at)
                VALUES (:id, '+573009999998', 'Lead de Prueba Trigger', 'test_lead_trigger@dailylover.test', NOW());
            """), {"id": test_uid})
            await db.commit()

            # 2. Insertar como lead pendiente de entrevista
            print(f"2. Registrando lead en 'leads_pendientes_entrevista' (sin notas clínicas)...")
            await db.execute(text("""
                INSERT INTO leads_pendientes_entrevista (user_id, full_name_raw, city, age, gender, plan_tier, bio_notes)
                VALUES (:id, 'Lead de Prueba Trigger', 'Bogotá', 29, 'Mujer', 'Estándar 65k (2 citas)', '');
            """), {"id": test_uid})
            await db.commit()

            # Verificar que está en leads_pendientes_entrevista y NO en profiles
            in_leads = (await db.execute(text("SELECT COUNT(*) FROM leads_pendientes_entrevista WHERE user_id = :id;"), {"id": test_uid})).scalar()
            in_profiles = (await db.execute(text("SELECT COUNT(*) FROM profiles WHERE user_id = :id;"), {"id": test_uid})).scalar()
            print(f"   → Estado inicial: en leads = {in_leads}, en profiles = {in_profiles}")
            assert in_leads == 1, "El lead no se insertó en leads_pendientes_entrevista"
            assert in_profiles == 0, "El lead ya estaba en profiles"

            # 3. Simular que la psicóloga completa la entrevista y guarda la ficha
            print(f"\n3. Psicóloga completa la entrevista clínica y guarda la ficha en 'profiles'...")
            await db.execute(text("""
                INSERT INTO profiles (user_id, full_name_raw, city, age, gender, plan_tier, bio_notes, responsable)
                VALUES (:id, 'Lead de Prueba Trigger', 'Bogotá', 29, 'Mujer', 'Estándar 65k (2 citas)', 'Entrevista completada con éxito. Excelente candidata.', 'SILVI');
            """), {"id": test_uid})
            await db.commit()

            # 4. Verificar si el trigger disparó la graduación automática
            print(f"\n4. Verificando ejecución del trigger en PostgreSQL...")
            in_leads_after = (await db.execute(text("SELECT COUNT(*) FROM leads_pendientes_entrevista WHERE user_id = :id;"), {"id": test_uid})).scalar()
            in_profiles_after = (await db.execute(text("SELECT COUNT(*) FROM profiles WHERE user_id = :id;"), {"id": test_uid})).scalar()

            print(f"   → Estado post-entrevista: en leads = {in_leads_after}, en profiles = {in_profiles_after}")

            if in_leads_after == 0 and in_profiles_after == 1:
                print("\n✅ ¡TRIGGER FUNCIONANDO AL 100% EN LA BASE DE DATOS REAL!")
                print("   El usuario fue promovido a 'profiles' y eliminado automáticamente de 'leads_pendientes_entrevista'.")
            else:
                print("\n❌ FALLO EN EL TRIGGER: el lead no se eliminó o no está en profiles.")

        finally:
            # 5. Limpieza de prueba
            print(f"\n5. Limpiando registro de prueba (UID {test_uid})...")
            await db.execute(text("DELETE FROM profiles WHERE user_id = :id;"), {"id": test_uid})
            await db.execute(text("DELETE FROM leads_pendientes_entrevista WHERE user_id = :id;"), {"id": test_uid})
            await db.execute(text("DELETE FROM users WHERE id = :id;"), {"id": test_uid})
            await db.commit()
            print("   ✓ Base de datos limpia sin residuos de prueba.")

if __name__ == "__main__":
    asyncio.run(test_trigger())
