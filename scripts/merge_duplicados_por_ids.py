#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fusión de fichas duplicadas de UNA persona (v2: los ids se pasan por argumento, nunca van escritos en el código).

Reemplaza a execute_merge_luis_felipe_correa.py, que traía los ids fijos (primary=1558) y no coincidían con la base real
(la ficha con CRM 4142 es la users.id=15587 y además hay una tercera ficha duplicada, la 12390).

Qué hace (mismo patrón ya probado en brief23/26):
  · Transaccional, todo o nada. NUNCA borra filas: redirige user_id / nombres y marca cada duplicado con
    merged_into_id / merged_at.
  · Redirige historical_matches, operational_matches (persona A y persona B), person_history y scheduled_dates (por nombre),
    client_notes y, con un barrido automático, toda llave foránea hacia users(id) (stripe_payments, priority_client_tracking...).
  · Completa profiles del primary con COALESCE (jamás sobrescribe un dato que el primary ya tenía).

Uso (desde el contenedor/servidor con POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_HOST):

  # 1) ENSAYO: ejecuta todo dentro de una transacción y la revierte. Muestra cuántas filas movería de cada tabla.
  python3 merge_duplicados_por_ids.py --primary 15587 --secondary 7246 --secondary 12390 --dry-run

  # 2) REAL: exige repetir el nombre EXACTO del primary como seguro contra ids equivocados.
  python3 merge_duplicados_por_ids.py --primary 15587 --secondary 7246 --secondary 12390 \
      --confirm-primary-name "Luis Felipe Correa Montoya"
"""
import argparse
import asyncio
import os
import sys

import asyncpg


class DryRunRollback(Exception):
    pass


def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--primary", type=int, required=True, help="users.id de la ficha que se conserva")
    ap.add_argument("--secondary", type=int, action="append", required=True, help="users.id de cada duplicado (repetible)")
    ap.add_argument("--dry-run", action="store_true", help="ensayo: todo se revierte al final")
    ap.add_argument("--confirm-primary-name", default="", help="nombre exacto del primary (obligatorio en modo real)")
    return ap.parse_args()


async def show_person(conn, uid: int, label: str):
    r = await conn.fetchrow("""
        SELECT u.id, u.name, u.crm_id, u.client_code, u.phone, u.email, u.created_at, u.merged_into_id,
               p.plan_tier, p.responsable, p.city, p.age,
               (SELECT COUNT(*) FROM operational_matches WHERE user_id_a = u.id OR user_id_b = u.id) AS om,
               (SELECT COUNT(*) FROM historical_matches WHERE user_id_a = u.id OR user_id_b = u.id) AS hm
        FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1
    """, uid)
    if not r:
        print(f"  {label} id={uid}: NO EXISTE")
        return None
    print(f"  {label} id={r['id']} | {r['name']!r} | client_code={r['client_code']} | CRM={r['crm_id']} | tel={r['phone']} | "
          f"email={r['email']} | creado={r['created_at']:%Y-%m-%d} | plan={r['plan_tier']} | resp={r['responsable']} | "
          f"operational={r['om']} historical={r['hm']} | merged_into={r['merged_into_id']}")
    return r


async def main():
    a = parse_args()
    if a.primary in a.secondary:
        sys.exit("❌ El primary no puede estar entre los duplicados.")
    if not a.dry_run and not a.confirm_primary_name:
        sys.exit("❌ En modo real hay que pasar --confirm-primary-name \"<nombre exacto del primary>\" (o usar --dry-run).")

    conn = await asyncpg.connect(
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", ""),
        database=os.environ.get("POSTGRES_DB", "dailylover"),
        host=os.environ.get("POSTGRES_HOST", "postgres"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
    )
    print(f"Modo: {'ENSAYO (se revierte todo)' if a.dry_run else 'EJECUCIÓN REAL'}\n")
    primary = await show_person(conn, a.primary, "PRIMARY  ")
    secondaries = []
    for sid in a.secondary:
        s = await show_person(conn, sid, "DUPLICADO")
        secondaries.append(s)
    if not primary or any(s is None for s in secondaries):
        await conn.close(); sys.exit("\n❌ Falta alguna ficha. No se tocó nada.")
    if primary["merged_into_id"] is not None:
        await conn.close(); sys.exit("\n❌ El primary ya está marcado como fusionado en otra ficha. No se tocó nada.")
    if not a.dry_run and a.confirm_primary_name.strip() != (primary["name"] or "").strip():
        await conn.close()
        sys.exit(f"\n❌ El nombre confirmado no coincide con el primary ({primary['name']!r}). No se tocó nada.")

    canonical = primary["name"]
    has_notes = bool(await conn.fetchrow("SELECT 1 FROM information_schema.tables WHERE table_name = 'client_notes'"))
    print(f"\nNombre canónico que quedará en las filas movidas: {canonical!r}\n")

    try:
        async with conn.transaction():
            for s in secondaries:
                sid = s["id"]
                if s["merged_into_id"] is not None:
                    print(f"── id={sid}: ya estaba fusionado en {s['merged_into_id']}, se omite.")
                    continue
                print(f"── Moviendo id={sid} ({s['name']!r}) → {a.primary}")
                steps = [
                    ("historical_matches (lado A)", "UPDATE historical_matches SET user_id_a = $1, person_a = $3 WHERE user_id_a = $2", (a.primary, sid, canonical)),
                    ("historical_matches (lado B)", "UPDATE historical_matches SET user_id_b = $1, person_b = $3 WHERE user_id_b = $2", (a.primary, sid, canonical)),
                    ("historical_matches (solo nombre A)", "UPDATE historical_matches SET person_a = $1 WHERE user_id_a IS NULL AND LOWER(TRIM(person_a)) = LOWER(TRIM($2))", (canonical, s["name"])),
                    ("historical_matches (solo nombre B)", "UPDATE historical_matches SET person_b = $1 WHERE user_id_b IS NULL AND LOWER(TRIM(person_b)) = LOWER(TRIM($2))", (canonical, s["name"])),
                    ("operational_matches (por user_id_a)", "UPDATE operational_matches SET user_id_a = $1, person_a_crm_id = $3, person_a = $4 WHERE user_id_a = $2", (a.primary, sid, primary["crm_id"], canonical)),
                    ("operational_matches (solo nombre)", "UPDATE operational_matches SET person_a = $1, person_a_crm_id = COALESCE(person_a_crm_id, $3) WHERE user_id_a IS NULL AND LOWER(TRIM(person_a)) = LOWER(TRIM($2))", (canonical, s["name"], primary["crm_id"])),
                    ("operational_matches (persona B por user_id_b)", "UPDATE operational_matches SET user_id_b = $1, person_b = $3, person_b_crm_id = $4 WHERE user_id_b = $2", (a.primary, sid, canonical, primary["crm_id"])),
                    ("operational_matches (persona B solo nombre)", "UPDATE operational_matches SET person_b = $1, person_b_crm_id = COALESCE(NULLIF(person_b_crm_id, ''), $3) WHERE user_id_b IS NULL AND LOWER(TRIM(person_b)) = LOWER(TRIM($2))", (canonical, s["name"], primary["crm_id"])),
                    ("person_history (nombre)", "UPDATE person_history SET person_name = $1 WHERE LOWER(TRIM(person_name)) = LOWER(TRIM($2))", (canonical, s["name"])),
                ]
                if has_notes:
                    steps.append(("client_notes", "UPDATE client_notes SET user_id = $1 WHERE user_id = $2", (a.primary, sid)))
                for label, sql, args in steps:
                    res = await conn.execute(sql, *args)
                    print(f"     {label:<38} {res}")
                # Barrido genérico: toda columna con llave foránea hacia users(id) (pagos, seguimiento prioritario, etc.),
                # salvo users.merged_into_id y profiles (que se completa aparte con COALESCE).
                fk_cols = await conn.fetch("""
                    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
                    FROM pg_constraint c
                    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
                    WHERE c.contype = 'f' AND c.confrelid = 'users'::regclass AND array_length(c.conkey, 1) = 1
                    ORDER BY 1, 2
                """)
                handled = {("operational_matches", "user_id_a"), ("operational_matches", "user_id_b"),
                           ("historical_matches", "user_id_a"), ("historical_matches", "user_id_b"),
                           ("client_notes", "user_id"), ("users", "merged_into_id"), ("profiles", "user_id")}
                for fk in fk_cols:
                    if (fk["tbl"], fk["col"]) in handled:
                        continue
                    if fk["col"] == "psychologist_id":
                        continue  # apunta a la psicóloga, no a la persona: no se toca
                    res = await conn.execute(f'UPDATE {fk["tbl"]} SET "{fk["col"]}" = $1 WHERE "{fk["col"]}" = $2', a.primary, sid)
                    if res != "UPDATE 0":
                        print(f"     {fk['tbl'] + '.' + fk['col'] + ' (FK)':<38} {res}")
                # Tablas que identifican a la persona solo por nombre
                for tbl, col in (("scheduled_dates", "person_a"), ("scheduled_dates", "person_b"),
                                 ("priority_client_tracking", "client_name"), ("cs_novedades", "client_name")):
                    exists = await conn.fetchval("SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2", tbl, col)
                    if not exists:
                        continue
                    res = await conn.execute(f'UPDATE {tbl} SET "{col}" = $1 WHERE LOWER(TRIM("{col}")) = LOWER(TRIM($2))', canonical, s["name"])
                    if res != "UPDATE 0":
                        print(f"     {tbl + '.' + col + ' (nombre)':<38} {res}")
                res = await conn.execute("""
                    UPDATE profiles p1 SET
                        city = COALESCE(p1.city, p2.city), estatura = COALESCE(p1.estatura, p2.estatura),
                        occupation = COALESCE(p1.occupation, p2.occupation), education = COALESCE(p1.education, p2.education),
                        religion = COALESCE(p1.religion, p2.religion), love_language = COALESCE(p1.love_language, p2.love_language),
                        bio_notes = COALESCE(p1.bio_notes, p2.bio_notes), lifestyle = COALESCE(p1.lifestyle, p2.lifestyle),
                        search_preferences = COALESCE(p1.search_preferences, p2.search_preferences),
                        plan_tier = COALESCE(p1.plan_tier, p2.plan_tier), photo_url = COALESCE(p1.photo_url, p2.photo_url),
                        ocean = COALESCE(p1.ocean, p2.ocean), apego = COALESCE(p1.apego, p2.apego),
                        motivacion = COALESCE(p1.motivacion, p2.motivacion), rol_social = COALESCE(p1.rol_social, p2.rol_social),
                        energia_social = COALESCE(p1.energia_social, p2.energia_social), momento_vital = COALESCE(p1.momento_vital, p2.momento_vital),
                        intereses = COALESCE(p1.intereses, p2.intereses), valores = COALESCE(p1.valores, p2.valores)
                    FROM profiles p2 WHERE p1.user_id = $1 AND p2.user_id = $2
                """, a.primary, sid)
                print(f"     {'profiles (completa con COALESCE)':<38} {res}")
                res = await conn.execute("UPDATE users SET merged_into_id = $1, merged_at = NOW() WHERE id = $2", a.primary, sid)
                print(f"     {'users (marca fusionado)':<38} {res}")

            print("\n=== VERIFICACIÓN (dentro de la transacción) ===")
            bad = False
            for s in secondaries:
                sid = s["id"]
                om = await conn.fetchval("SELECT COUNT(*) FROM operational_matches WHERE user_id_a = $1 OR user_id_b = $1", sid)
                hm = await conn.fetchval("SELECT COUNT(*) FROM historical_matches WHERE user_id_a = $1 OR user_id_b = $1", sid)
                ph = await conn.fetchval("SELECT COUNT(*) FROM person_history WHERE LOWER(TRIM(person_name)) = LOWER(TRIM($1))", s["name"])
                mg = await conn.fetchval("SELECT merged_into_id FROM users WHERE id = $1", sid)
                ok = om == 0 and hm == 0 and mg == a.primary and (ph == 0 or (s["name"] or "").strip().lower() == (canonical or "").strip().lower())
                bad = bad or not ok
                print(f"  id={sid}: operational={om} historical={hm} person_history={ph} merged_into={mg} → {'OK' if ok else 'REVISAR'}")
            print(f"  Bajo el primary {a.primary}: operational={await conn.fetchval('SELECT COUNT(*) FROM operational_matches WHERE user_id_a = $1 OR user_id_b = $1', a.primary)}"
                  f" historical={await conn.fetchval('SELECT COUNT(*) FROM historical_matches WHERE user_id_a = $1 OR user_id_b = $1', a.primary)}")
            if bad:
                raise RuntimeError("Quedaron referencias sueltas: se revierte todo.")
            if a.dry_run:
                raise DryRunRollback()
    except DryRunRollback:
        print("\n(ensayo) Todo revertido: no se escribió nada. Si los números son los esperados, corre sin --dry-run.")
    except Exception as e:
        print(f"\n❌ {e}\nSe revirtió todo; no se guardó nada.")
        await conn.close(); sys.exit(1)
    else:
        print("\n✅ Fusión guardada.")
    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
