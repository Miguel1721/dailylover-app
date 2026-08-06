#!/usr/bin/env python3
"""
Brief Técnico #21: Detección de clientes duplicados (multiseñal, optimizado, solo lectura)
Daily Lover SaaS (.162.11)
"""

import sys
import os
import csv
import re
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher

import asyncpg
import asyncio

def normalize_name(name: str) -> str:
    if not name:
        return ""
    n = unicodedata.normalize('NFD', str(name))
    n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    n = re.sub(r'\s+', ' ', n).strip().lower()
    return n

def name_similarity(a: str, b: str) -> float:
    na = normalize_name(a)
    nb = normalize_name(b)
    if not na or not nb:
        return 0.0
    return SequenceMatcher(None, na, nb).ratio()

def normalize_phone(phone: str) -> str:
    if not phone:
        return ""
    digits = re.sub(r'\D', '', str(phone))
    return digits[-10:] if len(digits) >= 10 else digits

def normalize_city(city: str) -> str:
    if not city:
        return ""
    n = unicodedata.normalize('NFD', str(city))
    n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', n).strip().lower()

async def find_duplicates():
    conn = await asyncpg.connect(
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "your_secure_postgres_password"),
        database=os.environ.get("POSTGRES_DB", "dailylover"),
        host=os.environ.get("POSTGRES_HOST", "postgres"),
        port=5432
    )

    query = """
        SELECT 
            u.id, 
            u.name, 
            u.phone, 
            u.email,
            p.city, 
            p.age
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        ORDER BY u.id ASC;
    """

    rows = await conn.fetch(query)
    await conn.close()

    print(f"Total clientes cargados para análisis: {len(rows)}")

    # Indexación por Nombre Normalizado y por Primer Token del Nombre
    name_buckets = defaultdict(list)
    token_buckets = defaultdict(list)
    phone_buckets = defaultdict(list)

    for r in rows:
        n_norm = normalize_name(r['name'])
        p_norm = normalize_phone(r['phone'])
        if n_norm:
            name_buckets[n_norm].append(r)
            first_word = n_norm.split()[0] if n_norm.split() else ""
            if first_word:
                token_buckets[first_word].append(r)
        if p_norm and len(p_norm) >= 7:
            phone_buckets[p_norm].append(r)

    candidates = []
    seen_pairs = set()

    # 1. Comparaciones por Teléfono Idéntico o Nombre Idéntico (Agrupación Rápida)
    for p_norm, p_rows in phone_buckets.items():
        if len(p_rows) > 1:
            for i in range(len(p_rows)):
                for j in range(i + 1, len(p_rows)):
                    u1, u2 = p_rows[i], p_rows[j]
                    pair_key = (min(u1['id'], u2['id']), max(u1['id'], u2['id']))
                    if pair_key in seen_pairs:
                        continue

                    n1_norm = normalize_name(u1['name'])
                    n2_norm = normalize_name(u2['name'])

                    if n1_norm == n2_norm:
                        seen_pairs.add(pair_key)
                        candidates.append({
                            "id_1": u1['id'], "nombre_1": u1['name'], "telefono_1": u1['phone'] or "", "ciudad_1": u1['city'] or "",
                            "id_2": u2['id'], "nombre_2": u2['name'], "telefono_2": u2['phone'] or "", "ciudad_2": u2['city'] or "",
                            "nivel_confianza": "ALTA", "motivo": "Nombre idéntico y teléfono idéntico"
                        })
                    elif name_similarity(u1['name'], u2['name']) >= 0.85:
                        seen_pairs.add(pair_key)
                        candidates.append({
                            "id_1": u1['id'], "nombre_1": u1['name'], "telefono_1": u1['phone'] or "", "ciudad_1": u1['city'] or "",
                            "id_2": u2['id'], "nombre_2": u2['name'], "telefono_2": u2['phone'] or "", "ciudad_2": u2['city'] or "",
                            "nivel_confianza": "ALTA", "motivo": "Teléfono idéntico y nombre muy similar"
                        })

    # 2. Nombres Idénticos Normalizados
    for n_norm, n_rows in name_buckets.items():
        if len(n_rows) > 1:
            for i in range(len(n_rows)):
                for j in range(i + 1, len(n_rows)):
                    u1, u2 = n_rows[i], n_rows[j]
                    pair_key = (min(u1['id'], u2['id']), max(u1['id'], u2['id']))
                    if pair_key in seen_pairs:
                        continue

                    p1_norm = normalize_phone(u1['phone'])
                    p2_norm = normalize_phone(u2['phone'])
                    c1_norm = normalize_city(u1['city'])
                    c2_norm = normalize_city(u2['city'])

                    # Regla 3: Mismo nombre exacto PERO teléfono distinto Y ciudad distinta -> NO duplicado (personas distintas)
                    if p1_norm and p2_norm and (p1_norm != p2_norm) and c1_norm and c2_norm and (c1_norm != c2_norm):
                        seen_pairs.add(pair_key)
                        continue

                    # Regla 4: Mismo nombre exacto sin suficiente info -> BAJA
                    seen_pairs.add(pair_key)
                    candidates.append({
                        "id_1": u1['id'], "nombre_1": u1['name'], "telefono_1": u1['phone'] or "", "ciudad_1": u1['city'] or "",
                        "id_2": u2['id'], "nombre_2": u2['name'], "telefono_2": u2['phone'] or "", "ciudad_2": u2['city'] or "",
                        "nivel_confianza": "BAJA", "motivo": "Nombre idéntico pero requiere verificación manual (falta teléfono/ciudad)"
                    })

    # 3. Comparación Fuzzy por Token de Primer Nombre
    for t_norm, t_rows in token_buckets.items():
        if len(t_rows) > 1 and len(t_rows) < 150: # Omitir tokens ultra comunes
            for i in range(len(t_rows)):
                u1 = t_rows[i]
                c1_norm = normalize_city(u1['city'])
                a1 = u1['age']

                for j in range(i + 1, len(t_rows)):
                    u2 = t_rows[j]
                    pair_key = (min(u1['id'], u2['id']), max(u1['id'], u2['id']))
                    if pair_key in seen_pairs:
                        continue

                    sim = name_similarity(u1['name'], u2['name'])
                    c2_norm = normalize_city(u2['city'])
                    a2 = u2['age']

                    if sim >= 0.90 and c1_norm and c2_norm and (c1_norm == c2_norm):
                        if a1 is not None and a2 is not None and abs(a1 - a2) <= 1:
                            seen_pairs.add(pair_key)
                            candidates.append({
                                "id_1": u1['id'], "nombre_1": u1['name'], "telefono_1": u1['phone'] or "", "ciudad_1": u1['city'] or "",
                                "id_2": u2['id'], "nombre_2": u2['name'], "telefono_2": u2['phone'] or "", "ciudad_2": u2['city'] or "",
                                "nivel_confianza": "MEDIA", "motivo": f"Nombre similar ({sim:.2f}), misma ciudad ('{c1_norm}') y edad (±1 año)"
                            })
                        elif a1 is None or a2 is None:
                            seen_pairs.add(pair_key)
                            candidates.append({
                                "id_1": u1['id'], "nombre_1": u1['name'], "telefono_1": u1['phone'] or "", "ciudad_1": u1['city'] or "",
                                "id_2": u2['id'], "nombre_2": u2['name'], "telefono_2": u2['phone'] or "", "ciudad_2": u2['city'] or "",
                                "nivel_confianza": "MEDIA", "motivo": f"Nombre similar ({sim:.2f}) y misma ciudad ('{c1_norm}') (edad no registrada)"
                            })

    rank_order = {"ALTA": 1, "MEDIA": 2, "BAJA": 3}
    candidates.sort(key=lambda x: (rank_order.get(x['nivel_confianza'], 99), x['id_1']))

    os.makedirs("/app/scratch", exist_ok=True)
    csv_path = "/app/scratch/reporte_duplicados_candidatos.csv"
    
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "id_1", "nombre_1", "telefono_1", "ciudad_1",
            "id_2", "nombre_2", "telefono_2", "ciudad_2",
            "nivel_confianza", "motivo"
        ])
        writer.writeheader()
        writer.writerows(candidates)

    print(f"\n✅ Análisis optimizado completado en segundos.")
    print(f"Reporte generado en: {csv_path}")
    print(f"Total candidatos a duplicado: {len(candidates)}")
    print(f"  - ALTA confianza:  {sum(1 for c in candidates if c['nivel_confianza'] == 'ALTA')}")
    print(f"  - MEDIA confianza: {sum(1 for c in candidates if c['nivel_confianza'] == 'MEDIA')}")
    print(f"  - BAJA confianza:  {sum(1 for c in candidates if c['nivel_confianza'] == 'BAJA')}")

if __name__ == "__main__":
    asyncio.run(find_duplicates())
