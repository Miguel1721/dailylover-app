#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Brief Técnico #26: Fusión de 1 caso fuzzy aprobado (Andrea Valencia 7113 -> 7010)
Excluye Jessica Merchan/Marchan (5323 vs 7097) por precaución (diferencia de edad y fecha de creación).
"""
import sys, os, asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect(
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "your_secure_postgres_password"),
        database=os.environ.get("POSTGRES_DB", "dailylover"),
        host=os.environ.get("POSTGRES_HOST", "postgres"),
        port=5432
    )

    primary_id = 7010
    secondary_id = 7113

    async with conn.transaction():
        await conn.execute(
            "UPDATE historical_matches SET user_id_a = $1 WHERE user_id_a = $2",
            primary_id, secondary_id
        )
        await conn.execute(
            "UPDATE historical_matches SET user_id_b = $1 WHERE user_id_b = $2",
            primary_id, secondary_id
        )
        await conn.execute(
            "UPDATE client_notes SET user_id = $1 WHERE user_id = $2",
            primary_id, secondary_id
        )
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
                photo_url       = COALESCE(p1.photo_url, p2.photo_url)
            FROM profiles p2
            WHERE p1.user_id = $1 AND p2.user_id = $2
        """, primary_id, secondary_id)
        await conn.execute(
            "UPDATE users SET merged_into_id = $1, merged_at = NOW() WHERE id = $2",
            primary_id, secondary_id
        )

    print("✅ Fusión de Andrea Valencia (7113 -> 7010) ejecutada exitosamente.")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
