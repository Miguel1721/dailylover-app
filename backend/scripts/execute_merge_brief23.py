#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Brief Técnico #23 — EJECUCIÓN REAL de fusión de 68 duplicados
Lee el plan aprobado (plan_fusion_brief23.json) y ejecuta las operaciones
en Postgres. NO borra nada — solo redirige FKs y marca merged_into_id.
"""
import sys, os, json, asyncio
import asyncpg

PLAN_PATH = "/app/scratch/plan_fusion_brief23.json"

async def merge_pair(conn, primary_id: int, secondary_id: int, nombre: str, idx: int):
    """Fusiona secondary → primary de forma transaccional."""
    async with conn.transaction():
        # 1. Redirigir historical_matches
        m_a = await conn.execute(
            "UPDATE historical_matches SET user_id_a = $1 WHERE user_id_a = $2",
            primary_id, secondary_id
        )
        m_b = await conn.execute(
            "UPDATE historical_matches SET user_id_b = $1 WHERE user_id_b = $2",
            primary_id, secondary_id
        )

        # 2. Redirigir client_notes
        n = await conn.execute(
            "UPDATE client_notes SET user_id = $1 WHERE user_id = $2",
            primary_id, secondary_id
        )

        # 3. Completar perfil del primary con datos del secondary (COALESCE — nunca sobreescribir)
        await conn.execute("""
            UPDATE profiles p1
            SET
                city            = COALESCE(p1.city, p2.city),
                neighborhood    = COALESCE(p1.neighborhood, p2.neighborhood),
                age             = COALESCE(p1.age, p2.age),
                gender          = COALESCE(p1.gender, p2.gender),
                orientation     = COALESCE(p1.orientation, p2.orientation),
                estatura        = COALESCE(p1.estatura, p2.estatura),
                occupation      = COALESCE(p1.occupation, p2.occupation),
                education       = COALESCE(p1.education, p2.education),
                religion        = COALESCE(p1.religion, p2.religion),
                love_language   = COALESCE(p1.love_language, p2.love_language),
                bio_notes       = COALESCE(p1.bio_notes, p2.bio_notes),
                lifestyle       = COALESCE(p1.lifestyle, p2.lifestyle),
                search_preferences = COALESCE(p1.search_preferences, p2.search_preferences),
                plan_tier       = COALESCE(p1.plan_tier, p2.plan_tier),
                photo_url       = COALESCE(p1.photo_url, p2.photo_url),
                ocean           = COALESCE(p1.ocean, p2.ocean),
                apego           = COALESCE(p1.apego, p2.apego),
                motivacion      = COALESCE(p1.motivacion, p2.motivacion),
                rol_social      = COALESCE(p1.rol_social, p2.rol_social),
                energia_social  = COALESCE(p1.energia_social, p2.energia_social),
                momento_vital   = COALESCE(p1.momento_vital, p2.momento_vital),
                intereses       = COALESCE(p1.intereses, p2.intereses),
                valores         = COALESCE(p1.valores, p2.valores)
            FROM profiles p2
            WHERE p1.user_id = $1 AND p2.user_id = $2
        """, primary_id, secondary_id)

        # 4. Marcar el secundario como fusionado (NO borrar)
        await conn.execute(
            "UPDATE users SET merged_into_id = $1, merged_at = NOW() WHERE id = $2",
            primary_id, secondary_id
        )

        rows_m = int(m_a.split()[-1]) + int(m_b.split()[-1])
        rows_n = int(n.split()[-1])
        print(f"  [{idx:>2}] OK  {nombre:<35} secondary={secondary_id:>6} → primary={primary_id:>6}  matches={rows_m}  notas={rows_n}")
        return rows_m, rows_n

async def main():
    # Cargar plan aprobado
    with open(PLAN_PATH, encoding="utf-8") as f:
        plan = json.load(f)

    print(f"Plan cargado: {len(plan)} entradas")

    # Deduplicar por (min_id, max_id) para manejar pares inversos (Ilona Martinez etc.)
    seen = set()
    deduped = []
    for entry in plan:
        key = (min(entry['primary_id'], entry['secondary_id']),
               max(entry['primary_id'], entry['secondary_id']))
        if key not in seen:
            seen.add(key)
            deduped.append(entry)

    print(f"Pares únicos tras deduplicación: {len(deduped)}")
    print()

    conn = await asyncpg.connect(
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "your_secure_postgres_password"),
        database=os.environ.get("POSTGRES_DB", "dailylover"),
        host=os.environ.get("POSTGRES_HOST", "postgres"),
        port=5432
    )

    total_matches = 0
    total_notas = 0
    errors = []

    print("=== EJECUCIÓN REAL ===")
    for entry in deduped:
        try:
            m, n = await merge_pair(
                conn,
                primary_id=entry['primary_id'],
                secondary_id=entry['secondary_id'],
                nombre=entry['nombre'],
                idx=entry['idx']
            )
            total_matches += m
            total_notas += n
        except Exception as e:
            print(f"  [{entry['idx']:>2}] ERROR {entry['nombre']}: {e}")
            errors.append((entry['idx'], entry['nombre'], str(e)))

    print()
    print("=" * 70)
    print("=== VERIFICACIÓN POST-FUSIÓN ===")

    # Contar usuarios activos (no fusionados)
    activos = await conn.fetchval("SELECT COUNT(*) FROM users WHERE merged_into_id IS NULL")
    fusionados = await conn.fetchval("SELECT COUNT(*) FROM users WHERE merged_into_id IS NOT NULL")
    total_users = await conn.fetchval("SELECT COUNT(*) FROM users")

    print(f"  Total usuarios:     {total_users}")
    print(f"  Activos (no fus.):  {activos}")
    print(f"  Fusionados:         {fusionados}")

    # Verificar que no queden matches/notas huérfanos apuntando a secundarios
    huerfanos_matches = await conn.fetchval("""
        SELECT COUNT(*) FROM historical_matches hm
        JOIN users u ON (hm.user_id_a = u.id OR hm.user_id_b = u.id)
        WHERE u.merged_into_id IS NOT NULL
    """)
    huerfanos_notas = await conn.fetchval("""
        SELECT COUNT(*) FROM client_notes cn
        JOIN users u ON cn.user_id = u.id
        WHERE u.merged_into_id IS NOT NULL
    """)

    print(f"\n  Matches aún apuntando a secundarios fusionados: {huerfanos_matches}")
    print(f"  Notas  aún apuntando a secundarios fusionados: {huerfanos_notas}")

    print(f"\n  Matches redirigidos en esta ejecución: {total_matches}")
    print(f"  Notas   redirigidas en esta ejecución: {total_notas}")
    print(f"  Errores: {len(errors)}")
    if errors:
        for idx, nombre, msg in errors:
            print(f"    [{idx}] {nombre}: {msg}")

    await conn.close()

    if huerfanos_matches == 0 and huerfanos_notas == 0 and len(errors) == 0:
        print(f"\n✅ Brief #23 completado exitosamente. 0 huerfanos. {fusionados} usuarios marcados como fusionados.")
    else:
        print(f"\n⚠️  Brief #23 ejecutado con advertencias. Revisar huerfanos/errores arriba.")

if __name__ == "__main__":
    asyncio.run(main())
