#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Brief Técnico #25: Cerrar los pendientes de PROFILES LAU/ALEJA/MANU
- Re-intento de match para "Alexander Rodríguez. 10/07" y "Jeison Moreno. 10/07" (stripping trailing dates)
- Descarte de "1063" como fila basura
- Aplicar las 5 coincidencias fuzzy confirmadas
- Migrar nota "le falta 1" de Rene Alejandro Muñeton (ID 8968) a client_notes
- Actualizar los 3 CSVs
"""
import sys, os, csv, re, unicodedata, asyncio
import asyncpg

def normalize_name(name: str) -> str:
    if not name:
        return ""
    n = unicodedata.normalize('NFD', str(name))
    n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    n = re.sub(r'\s+', ' ', n).strip().lower()
    return n

def strip_trailing_date(name: str) -> str:
    if not name:
        return ""
    # Quita patrones tipo ". 10/07", "10/07", " 10/07" al final del string
    clean = re.sub(r'\.?\s*\d{1,2}/\d{1,2}\s*$', '', name).strip()
    return clean

async def main():
    conn = await asyncpg.connect(
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "your_secure_postgres_password"),
        database=os.environ.get("POSTGRES_DB", "dailylover"),
        host=os.environ.get("POSTGRES_HOST", "postgres"),
        port=5432
    )

    db_users = await conn.fetch("SELECT id, name FROM users WHERE name IS NOT NULL AND name != '';")
    user_map_exact = {normalize_name(u['name']): (u['id'], u['name']) for u in db_users}

    print("=== BRIEF #25: RE-INTENTO DE MATCHES CON FECHA ===")
    date_names = ["Alexander Rodríguez. 10/07", "Jeison Moreno. 10/07"]
    date_results = {}
    for raw_n in date_names:
        clean_n = strip_trailing_date(raw_n)
        norm_n = normalize_name(clean_n)
        if norm_n in user_map_exact:
            uid, db_name = user_map_exact[norm_n]
            date_results[raw_n] = (uid, db_name, "exacto_limpio")
            print(f"  ✅ '{raw_n}' -> limpio '{clean_n}' -> MATCH EXACTO ID {uid} ({db_name})")
        else:
            date_results[raw_n] = (None, None, "no_encontrado")
            print(f"  ❌ '{raw_n}' -> limpio '{clean_n}' -> NO ENCONTRADO")

    # 2. Migrar nota de Rene Alejandro Muñeton (ID 8968)
    rene_note = "le falta 1"
    rene_uid = 8968
    note_exists = await conn.fetchval(
        "SELECT 1 FROM client_notes WHERE user_id = $1 AND note = $2 AND source = 'profiles_aleja_legacy';",
        rene_uid, rene_note
    )
    if not note_exists:
        await conn.execute("""
            INSERT INTO client_notes (user_id, note, source, created_at)
            VALUES ($1, $2, 'profiles_aleja_legacy', NOW())
        """, rene_uid, rene_note)
        print(f"\n✅ Nota '{rene_note}' insertada en client_notes para Rene Alejandro Muñeton (ID {rene_uid}).")
    else:
        print(f"\nℹ️ Nota '{rene_note}' ya existía en client_notes para ID {rene_uid}.")

    await conn.close()

    # 3. Actualizar CSVs
    print("\n=== ACTUALIZANDO REPORTES CSV ===")

    # A. PROFILES MANU
    manu_path = "/app/scratch/reporte_profiles_manu.csv"
    manu_rows = []
    with open(manu_path, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            name_orig = r['nombre_original']
            if name_orig == "Alexandra Piña":
                r['user_id_encontrado'] = "6016"
                r['nombre_encontrado'] = "Alexandra Piña"
                r['tipo_match'] = "fuzzy_aprobado"
            elif name_orig == "Melisa Alvarez":
                r['user_id_encontrado'] = "6547"
                r['nombre_encontrado'] = "Melisa Alvarez"
                r['tipo_match'] = "fuzzy_aprobado"
            manu_rows.append(r)

    with open(manu_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=manu_rows[0].keys())
        w.writeheader()
        w.writerows(manu_rows)
    print(f"  ✅ {manu_path} actualizado (Alexandra Piña ID 6016, Melisa Alvarez ID 6547)")

    # B. PROFILES LAU
    lau_path = "/app/scratch/reporte_profiles_lau.csv"
    lau_rows = []
    with open(lau_path, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            name_orig = r['nombre_original']
            if name_orig == "Maria Pia Santacruz":
                r['user_id_encontrado'] = "8861"
                r['nombre_encontrado'] = "Maria Pia Santacruz"
                r['tipo_match'] = "fuzzy_aprobado"
            elif name_orig == "Paola Lugo":
                r['user_id_encontrado'] = "8901"
                r['nombre_encontrado'] = "Paola Lugo"
                r['tipo_match'] = "fuzzy_aprobado"
            elif name_orig == "1063":
                r['user_id_encontrado'] = ""
                r['nombre_encontrado'] = ""
                r['tipo_match'] = "descartado_basura"
            elif name_orig in date_results:
                uid, db_name, match_t = date_results[name_orig]
                if uid:
                    r['user_id_encontrado'] = str(uid)
                    r['nombre_encontrado'] = db_name
                    r['tipo_match'] = match_t
            lau_rows.append(r)

    with open(lau_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=lau_rows[0].keys())
        w.writeheader()
        w.writerows(lau_rows)
    print(f"  ✅ {lau_path} actualizado (Maria Pia Santacruz ID 8861, Paola Lugo ID 8901, 1063 descartado, fechas procesadas)")

    # C. PROFILES ALEJA
    aleja_path = "/app/scratch/reporte_profiles_aleja.csv"
    aleja_rows = []
    with open(aleja_path, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            name_orig = r['nombre_original']
            if name_orig == "Rene Alejandro Muñeton":
                r['user_id_encontrado'] = "8968"
                r['nombre_encontrado'] = "Rene Alejandro Muñeton"
                r['tipo_match'] = "fuzzy_aprobado"
                r['nota_columna_b'] = rene_note
            elif name_orig == "Camilo Vallejo Espinal":
                r['user_id_encontrado'] = ""
                r['nombre_encontrado'] = ""
                r['tipo_match'] = "descartado_no_crear"
            aleja_rows.append(r)

    with open(aleja_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=aleja_rows[0].keys())
        w.writeheader()
        w.writerows(aleja_rows)
    print(f"  ✅ {aleja_path} actualizado (Rene Alejandro Muñeton ID 8968 + nota 'le falta 1', Camilo Vallejo Espinal descartado)")

    print("\n✅ Brief Técnico #25 completado exitosamente.")

if __name__ == "__main__":
    asyncio.run(main())
