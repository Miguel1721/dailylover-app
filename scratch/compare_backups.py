#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, os, asyncio
import asyncpg

async def main():
    c_temp = await asyncpg.connect(
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "your_secure_postgres_password"),
        database="dailylover_temp",
        host=os.environ.get("POSTGRES_HOST", "postgres"),
        port=5432
    )
    c_act = await asyncpg.connect(
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "your_secure_postgres_password"),
        database=os.environ.get("POSTGRES_DB", "dailylover"),
        host=os.environ.get("POSTGRES_HOST", "postgres"),
        port=5432
    )

    ids_temp = set(r['id'] for r in await c_temp.fetch('SELECT id FROM users;'))
    ids_act = set(r['id'] for r in await c_act.fetch('SELECT id FROM users;'))

    print("=== RESULTADO DE COMPARACIÓN EXACTA ===")
    print(f"Total IDs en backup PRE-MERGE (dailylover_temp): {len(ids_temp)}")
    print(f"Total IDs en DB ACTUAL        (dailylover):      {len(ids_act)}")

    borrados = ids_temp - ids_act
    nuevos = ids_act - ids_temp

    print(f"\nIDs que estaban en el backup pero NO están en DB actual: {len(borrados)}")
    if borrados:
        rows = await c_temp.fetch('SELECT id, name, created_at FROM users WHERE id = ANY($1::int[])', list(borrados))
        for r in rows:
            print(f"  - ID {r['id']}: {r['name']} (creado: {r['created_at']})")

    print(f"\nIDs agregados después del backup: {len(nuevos)}")

    await c_temp.close()
    await c_act.close()

if __name__ == "__main__":
    asyncio.run(main())
