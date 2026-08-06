#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Brief Técnico #23 — DRY-RUN de fusión de 68 duplicados de alta confianza
Lee el CSV de duplicados, filtra los 68 pares (1 ALTA + 67 MEDIA sim=1.00),
consulta la DB y decide cuál es primary/secondary por las reglas del brief.
NO escribe nada en la base de datos.
"""
import sys, os, csv, re, asyncio, json
import asyncpg

CSV_PATH = "/app/scratch/reporte_duplicados_candidatos.csv"

def is_real_colombian_phone(p):
    if not p:
        return False
    p = p.strip()
    # Real: +573XXXXXXXXX y no empieza con +573000000 (sintético)
    if re.match(r'^\+573\d{9}$', p) and not p.startswith('+573000000'):
        return True
    return False

def choose_primary(u_a, u_b, prof_a, prof_b):
    """
    Retorna (primary, secondary, regla_usada)
    Regla 1: teléfono real colombiano
    Regla 2: más campos completos en profiles
    Regla 3: created_at más antiguo
    """
    real_a = is_real_colombian_phone(u_a['phone'])
    real_b = is_real_colombian_phone(u_b['phone'])

    if real_a and not real_b:
        return u_a, u_b, "REGLA-1 (teléfono real colombiano en A)"
    if real_b and not real_a:
        return u_b, u_a, "REGLA-1 (teléfono real colombiano en B)"

    comp_a = sum(1 for v in prof_a.values() if v not in (None, ''))
    comp_b = sum(1 for v in prof_b.values() if v not in (None, ''))
    if comp_a != comp_b:
        if comp_a > comp_b:
            return u_a, u_b, f"REGLA-2 (perfil más completo en A: {comp_a} vs {comp_b})"
        else:
            return u_b, u_a, f"REGLA-2 (perfil más completo en B: {comp_b} vs {comp_a})"

    if u_a['created_at'] and u_b['created_at']:
        if u_a['created_at'] <= u_b['created_at']:
            return u_a, u_b, "REGLA-3 (created_at más antiguo en A)"
        else:
            return u_b, u_a, "REGLA-3 (created_at más antiguo en B)"

    return u_a, u_b, "REGLA-3-DEFAULT (empate total, se conserva A)"

async def main():
    # 1. Leer CSV y filtrar los 68 pares
    pairs_68 = []
    with open(CSV_PATH, encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            nivel = row['nivel_confianza']
            motivo = row['motivo']
            if nivel == 'ALTA':
                pairs_68.append(row)
            elif nivel == 'MEDIA' and 'similar (1.00)' in motivo:
                pairs_68.append(row)

    print(f"Pares filtrados para dry-run: {len(pairs_68)}")
    print(f"  ALTA: {sum(1 for r in pairs_68 if r['nivel_confianza']=='ALTA')}")
    print(f"  MEDIA sim=1.00: {sum(1 for r in pairs_68 if r['nivel_confianza']=='MEDIA')}")
    print()

    # 2. Conectar a Postgres
    conn = await asyncpg.connect(
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "your_secure_postgres_password"),
        database=os.environ.get("POSTGRES_DB", "dailylover"),
        host=os.environ.get("POSTGRES_HOST", "postgres"),
        port=5432
    )

    # 3. Dry-run por par
    results = []
    rule_counts = {"REGLA-1": 0, "REGLA-2": 0, "REGLA-3": 0}
    skipped = []

    print("=" * 100)
    print(f"{'#':>3}  {'PRIMARY ID':>10}  {'SECONDARY ID':>12}  {'REGLA':40}  NOMBRE")
    print("=" * 100)

    for i, row in enumerate(pairs_68):
        id1 = int(row['id_1'])
        id2 = int(row['id_2'])

        # Obtener datos completos
        u1 = await conn.fetchrow("SELECT id, name, phone, email, created_at FROM users WHERE id=$1", id1)
        u2 = await conn.fetchrow("SELECT id, name, phone, email, created_at FROM users WHERE id=$1", id2)

        if not u1 or not u2:
            skipped.append((id1, id2, "Usuario no encontrado en DB"))
            continue

        p1 = await conn.fetchrow("SELECT * FROM profiles WHERE user_id=$1", id1)
        p2 = await conn.fetchrow("SELECT * FROM profiles WHERE user_id=$1", id2)

        prof1 = dict(p1) if p1 else {}
        prof2 = dict(p2) if p2 else {}

        u1d = dict(u1)
        u2d = dict(u2)

        primary, secondary, regla = choose_primary(u1d, u2d, prof1, prof2)

        # Contar referencias
        matches_count = await conn.fetchval(
            "SELECT COUNT(*) FROM historical_matches WHERE user_id_a=$1 OR user_id_b=$1",
            secondary['id']
        )
        notes_count = await conn.fetchval(
            "SELECT COUNT(*) FROM client_notes WHERE user_id=$1",
            secondary['id']
        )

        rule_key = regla.split()[0]
        rule_counts[rule_key] = rule_counts.get(rule_key, 0) + 1

        tag = row['nivel_confianza']
        print(f"{i+1:>3}  [{tag}]  primary={primary['id']:>6}  secondary={secondary['id']:>6}  {regla[:38]:38}  {primary['name']}")
        print(f"      primary  phone={primary['phone'] or 'NULL':25}  perfil={sum(1 for v in prof1.values() if v not in (None,'')) if primary['id']==id1 else sum(1 for v in prof2.values() if v not in (None,''))} campos")
        print(f"      secondary phone={secondary['phone'] or 'NULL':25}  matches={matches_count}  notas={notes_count}")
        print()

        results.append({
            "idx": i + 1,
            "nivel": tag,
            "primary_id": primary['id'],
            "secondary_id": secondary['id'],
            "regla": regla,
            "nombre": primary['name'],
            "matches_a_redirigir": int(matches_count),
            "notas_a_redirigir": int(notes_count),
        })

    await conn.close()

    print("=" * 100)
    print(f"\nRESUMEN DRY-RUN:")
    print(f"  Pares procesados:  {len(results)}")
    print(f"  Saltados (error):  {len(skipped)}")
    for sk in skipped:
        print(f"    - IDs ({sk[0]},{sk[1]}): {sk[2]}")
    print(f"\nDistribución de reglas:")
    for k, v in sorted(rule_counts.items()):
        print(f"  {k}: {v} pares")
    total_matches = sum(r['matches_a_redirigir'] for r in results)
    total_notas = sum(r['notas_a_redirigir'] for r in results)
    print(f"\nTotal matches que se redirigirían: {total_matches}")
    print(f"Total notas que se redirigirían:   {total_notas}")
    print(f"\n⚠️  NADA FUE ESCRITO — DRY-RUN COMPLETADO. Esperando aprobación de Miguel para ejecutar en real.")

    # Guardar JSON con el plan completo para usar en la ejecución real
    plan_path = "/app/scratch/plan_fusion_brief23.json"
    with open(plan_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2, default=str)
    print(f"Plan guardado en: {plan_path}")

if __name__ == "__main__":
    asyncio.run(main())
