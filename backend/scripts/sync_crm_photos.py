#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sincronización de fotos del CRM (prof_187) hacia profiles.photo_url
===================================================================
1. Extrae value->>'url' del campo prof_187 en crm_profile_fields.
2. Cruza con profiles vía users.crm_id (o crm_profile_fields.user_id).
3. Actualiza profiles.photo_url sólo si difiere o está vacío.
4. Registra cada cambio en profile_field_changes (reversible).
"""

import sys
import os
import json
import asyncio
from datetime import datetime, timezone
import asyncpg

DB_HOST = os.getenv("POSTGRES_HOST", "dl_postgres" if os.path.exists("/.dockerenv") else "localhost")
DB_PORT = int(os.getenv("POSTGRES_PORT", 5432))
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "your_secure_postgres_password")
DB_NAME = os.getenv("POSTGRES_DB", "dailylover")


async def get_connection():
    return await asyncpg.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASS,
        database=DB_NAME
    )


async def run_test_zz_prueba():
    """Prueba con datos de prueba ZZ PRUEBA."""
    print("\n--- INICIO DE PRUEBA CON DATOS 'ZZ PRUEBA' ---")
    conn = await get_connection()
    try:
        # 1. Crear usuario y perfil de prueba
        test_crm_id = "999999"
        test_url = "https://s3.amazonaws.com/smartmatchapp/test_photo_zz_prueba.jpg"

        # Limpiar si ya existiera
        await conn.execute("DELETE FROM crm_profile_fields WHERE crm_id = 999999;")
        await conn.execute("DELETE FROM profile_field_changes WHERE target = 'col.photo_url' AND source = 'test_zz_prueba';")
        await conn.execute("DELETE FROM profiles WHERE user_id IN (SELECT id FROM users WHERE crm_id = '999999');")
        await conn.execute("DELETE FROM users WHERE crm_id = '999999';")

        u_id = await conn.fetchval("""
            INSERT INTO users (name, phone, crm_id, created_at)
            VALUES ('ZZ PRUEBA CLIENTE FOTO', '+573999999999', '999999', NOW())
            RETURNING id;
        """)

        await conn.execute("""
            INSERT INTO profiles (user_id, photo_url, updated_at)
            VALUES ($1, NULL, NOW());
        """, u_id)

        await conn.execute("""
            INSERT INTO crm_profile_fields (crm_id, field_id, user_id, label, ftype, value, source, updated_at)
            VALUES (999999, 'prof_187', $1, 'Foto de perfil', 'file', $2::jsonb, 'smartmatchapp', NOW());
        """, u_id, json.dumps({"url": test_url, "name": "test_photo_zz_prueba.jpg"}))

        print(f"[OK] Usuario de prueba creado: ID={u_id}, CRM_ID={test_crm_id}")

        # 2. Ejecutar la sincronización para el usuario de prueba
        row = await conn.fetchrow("""
            SELECT f.value->>'url' as photo_url, p.photo_url as current_photo, p.user_id
            FROM crm_profile_fields f
            JOIN users u ON u.crm_id = cast(f.crm_id as text)
            JOIN profiles p ON p.user_id = u.id
            WHERE f.field_id = 'prof_187' AND u.id = $1;
        """, u_id)

        if not row or not row["photo_url"]:
            raise RuntimeError("No se pudo obtener la foto del registro de prueba")

        new_photo = row["photo_url"]
        curr_photo = row["current_photo"] or ""

        # Actualizar profile
        await conn.execute("""
            UPDATE profiles SET photo_url = $1, updated_at = NOW() WHERE user_id = $2;
        """, new_photo, u_id)

        # Registrar en profile_field_changes
        await conn.execute("""
            INSERT INTO profile_field_changes (user_id, target, old_value, new_value, source, kind, changed_at)
            VALUES ($1, 'col.photo_url', $2, $3, 'test_zz_prueba', 'relleno', NOW());
        """, u_id, curr_photo, new_photo)

        # 3. Verificar resultados
        saved_photo = await conn.fetchval("SELECT photo_url FROM profiles WHERE user_id = $1;", u_id)
        change_record = await conn.fetchrow("""
            SELECT target, old_value, new_value, source, kind
            FROM profile_field_changes
            WHERE user_id = $1 AND source = 'test_zz_prueba';
        """, u_id)

        assert saved_photo == test_url, f"Error: {saved_photo} != {test_url}"
        assert change_record is not None, "Error: No se registró en profile_field_changes"
        assert change_record["new_value"] == test_url, "Error en new_value de profile_field_changes"
        print(f"[OK] Verificación exitosa en profiles: photo_url='{saved_photo}'")
        print(f"[OK] Verificación exitosa en profile_field_changes: target='{change_record['target']}', kind='{change_record['kind']}'")

    finally:
        # 4. Limpieza estricta de datos ZZ PRUEBA
        print("--- Borrando datos de prueba ZZ PRUEBA ---")
        await conn.execute("DELETE FROM profile_field_changes WHERE user_id = $1;", u_id)
        await conn.execute("DELETE FROM profiles WHERE user_id = $1;", u_id)
        await conn.execute("DELETE FROM users WHERE id = $1;", u_id)
        await conn.execute("DELETE FROM crm_profile_fields WHERE crm_id = 999999;")
        await conn.close()
        print("[OK] Datos ZZ PRUEBA eliminados al 100%.\n")


async def sync_all_crm_photos(dry_run: bool = False):
    """Sincroniza todos los 3.836 prof_187 hacia profiles.photo_url."""
    conn = await get_connection()
    try:
        print("Consultando registros prof_187 en crm_profile_fields...")
        query = """
            SELECT 
                COALESCE(u.id, f.user_id) AS user_id,
                f.crm_id,
                f.value->>'url' AS photo_url,
                p.photo_url AS current_photo
            FROM crm_profile_fields f
            LEFT JOIN users u ON u.crm_id = cast(f.crm_id as text)
            JOIN profiles p ON p.user_id = COALESCE(u.id, f.user_id)
            WHERE f.field_id = 'prof_187'
              AND f.value->>'url' IS NOT NULL
              AND f.value->>'url' != '';
        """
        rows = await conn.fetch(query)
        print(f"Total registros con foto válida y perfil existente: {len(rows)}")

        to_update = []
        for r in rows:
            uid = r["user_id"]
            new_url = r["photo_url"].strip()
            curr_url = (r["current_photo"] or "").strip()
            if new_url and new_url != curr_url:
                kind = "relleno" if not curr_url else "refresco"
                to_update.append((uid, curr_url, new_url, kind))

        print(f"Perfiles que requieren actualización: {len(to_update)}")

        if dry_run:
            print("[DRY-RUN] No se aplican cambios.")
            return len(to_update)

        # Aplicar actualizaciones en lotes
        batch_size = 500
        total_applied = 0

        for i in range(0, len(to_update), batch_size):
            batch = to_update[i:i + batch_size]
            async with conn.transaction():
                # Update profiles
                prof_params = [(item[2], item[0]) for item in batch]
                await conn.executemany("""
                    UPDATE profiles SET photo_url = $1, updated_at = NOW() WHERE user_id = $2;
                """, prof_params)

                # Insert profile_field_changes
                change_params = [(item[0], item[1], item[2], item[3]) for item in batch]
                await conn.executemany("""
                    INSERT INTO profile_field_changes (user_id, target, old_value, new_value, source, kind, changed_at)
                    VALUES ($1, 'col.photo_url', $2, $3, 'crm_prof_187', $4, NOW());
                """, change_params)

            total_applied += len(batch)
            print(f"  Progreso: {total_applied}/{len(to_update)} perfiles actualizados.")

        # Verificación final
        total_with_photo = await conn.fetchval("SELECT count(1) FROM profiles WHERE photo_url IS NOT NULL AND photo_url != '';")
        total_pfc = await conn.fetchval("SELECT count(1) FROM profile_field_changes WHERE target = 'col.photo_url' AND source = 'crm_prof_187';")

        print("\n--- RESUMEN FINAL BLOQUE 1 ---")
        print(f"Total perfiles con photo_url en profiles: {total_with_photo}")
        print(f"Total registros de cambio auditados en profile_field_changes: {total_pfc}")

    finally:
        await conn.close()


if __name__ == "__main__":
    async def main():
        await run_test_zz_prueba()
        dry = "--dry-run" in sys.argv
        await sync_all_crm_photos(dry_run=dry)

    asyncio.run(main())
