"""Revision diaria de los slots en 'No hay gente': busca candidatas nuevas con el motor y deja el aviso en la tarjeta.

La primera revision de cada slot solo guarda la linea base (lo que el motor ya ve); desde la segunda,
cualquier candidata que no estaba en la base se guarda en `nuevos` y la tarjeta muestra "Posibilidad de nuevo match".
Uso: docker exec -w /app -e PYTHONPATH=/app dl_api python /app/scripts/cron_no_hay_gente.py   (NOGENTE_MAX=60 por defecto)
"""
import asyncio
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime

from sqlalchemy import text

from app.database import AsyncSessionLocal as S
from app.services.auth_service import create_access_token

MAX = int(os.getenv("NOGENTE_MAX", "60"))
BASE = "http://localhost:8000/api/v1/matchmaking/candidate-matches-engine"


def lista(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in ("candidates", "candidatas", "matches", "viable_matches", "suggested_matches", "results", "items"):
            if isinstance(data.get(k), list):
                return data[k]
    return []


def jl(v):
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return []
    return v or []


async def main():
    async with S() as db:
        ua = (await db.execute(text("SELECT id, role_id FROM user_accounts WHERE email = 'miguel.lozano1408@gmail.com'"))).fetchone()
        rows = (await db.execute(text("""
            SELECT m.id, m.user_id_a, m.person_a, v.vistos, v.nuevos
            FROM operational_matches m
            LEFT JOIN no_gente_vigilancia v ON v.match_id = m.id
            WHERE UPPER(COALESCE(m.status, '')) LIKE '%NO HAY GENTE%'
              AND COALESCE(TRIM(m.person_b), '') = ''
              AND m.user_id_a IS NOT NULL
            ORDER BY v.ultima_revision NULLS FIRST, m.id
            LIMIT :n
        """), {"n": MAX})).fetchall()
    if not ua:
        print("sin cuenta de servicio para consultar el motor")
        return
    H = {"Authorization": "Bearer " + create_access_token(str(ua.id), str(ua.role_id))}
    revisados = con_nuevos = errores = 0
    for r in rows:
        try:
            url = BASE + "?" + urllib.parse.urlencode({"client_id": str(r.user_id_a), "limit": 8, "force_refresh": "true"})
            data = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=240).read().decode())
        except Exception as e:
            errores += 1
            print("error", r.person_a, str(e)[:120])
            continue
        cands = {}
        for c in lista(data):
            uid = c.get("user_id")
            if uid:
                cands[str(uid)] = {"user_id": str(uid), "name": c.get("name") or c.get("person_b") or "", "crm_id": c.get("crm_id") or "", "score": c.get("score")}
        vistos = set(map(str, jl(r.vistos)))
        nuevos_prev = jl(r.nuevos)
        primera = r.vistos is None
        if primera:
            nuevos = []
        else:
            conocidos = {str(x.get("user_id")) for x in nuevos_prev}
            nuevos = list(nuevos_prev) + [c for u, c in cands.items() if u not in vistos and u not in conocidos]
        vistos_nuevo = sorted(vistos | set(cands.keys()))
        hay = len(nuevos) > len(nuevos_prev)
        async with S() as db:
            await db.execute(text("""
                INSERT INTO no_gente_vigilancia (match_id, user_id_a, vistos, nuevos, ultima_revision, detectado_en)
                VALUES (:m, :u, CAST(:v AS jsonb), CAST(:n AS jsonb), NOW(), CASE WHEN :h THEN NOW() ELSE NULL END)
                ON CONFLICT (match_id) DO UPDATE SET vistos = CAST(:v AS jsonb), nuevos = CAST(:n AS jsonb), ultima_revision = NOW(),
                    detectado_en = CASE WHEN :h THEN NOW() ELSE no_gente_vigilancia.detectado_en END
            """), {"m": r.id, "u": str(r.user_id_a), "v": json.dumps(vistos_nuevo), "n": json.dumps(nuevos), "h": hay})
            await db.commit()
        revisados += 1
        if hay:
            con_nuevos += 1
            print("NUEVO", r.person_a, [c["name"] for c in nuevos])
    async with S() as db:
        await db.execute(text("""
            DELETE FROM no_gente_vigilancia v WHERE NOT EXISTS (
                SELECT 1 FROM operational_matches m WHERE m.id = v.match_id
                  AND UPPER(COALESCE(m.status, '')) LIKE '%NO HAY GENTE%' AND COALESCE(TRIM(m.person_b), '') = '')
        """))
        await db.commit()
    print(f"{datetime.now():%Y-%m-%d %H:%M} revisados={revisados} con_candidatas_nuevas={con_nuevos} errores={errores} de {len(rows)}")


asyncio.run(main())
