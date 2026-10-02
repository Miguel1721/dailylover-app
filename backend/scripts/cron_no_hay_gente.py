"""Revision diaria de las personas en 'No hay gente' (v2, barata): primero filtros basicos sobre gente nueva; el motor solo se consulta
si hay candidatas nuevas compatibles (o en la revision completa semanal). La IA no corre aqui.
Uso: docker exec -w /app -e PYTHONPATH=/app dl_api python /app/scripts/cron_no_hay_gente.py   (NOGENTE_MOTOR_MAX=60 consultas al motor por corrida)
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
from app.services.no_hay_gente import revisar_persona

MOTOR_MAX = int(os.getenv("NOGENTE_MOTOR_MAX", os.getenv("NOGENTE_MAX", "60")))
BASE = "http://localhost:8000/api/v1/matchmaking/candidate-matches-engine"


def lista(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in ("candidates", "candidatas", "matches", "viable_matches", "suggested_matches", "results", "items"):
            if isinstance(data.get(k), list):
                return data[k]
    return []


async def main():
    async with S() as db:
        ua = (await db.execute(text("SELECT id, role_id FROM user_accounts WHERE email = 'miguel.lozano1408@gmail.com'"))).fetchone()
        personas = [r[0] for r in (await db.execute(text("""
            SELECT m.user_id_a FROM operational_matches m LEFT JOIN no_gente_vigilancia v ON v.match_id = m.id
            WHERE UPPER(COALESCE(m.status, '')) LIKE '%NO HAY GENTE%' AND COALESCE(TRIM(m.person_b), '') = '' AND m.user_id_a IS NOT NULL
            GROUP BY m.user_id_a ORDER BY MIN(v.ultima_revision) NULLS FIRST, m.user_id_a"""))).fetchall()]
    if not ua:
        print("sin cuenta de servicio para consultar el motor")
        return
    H = {"Authorization": "Bearer " + create_access_token(str(ua.id), str(ua.role_id))}
    llamadas = {"n": 0}

    async def motor(uid):
        llamadas["n"] += 1
        url = BASE + "?" + urllib.parse.urlencode({"client_id": str(uid), "limit": 8, "force_refresh": "true"})
        return lista(json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=240).read().decode()))

    revisadas = con_nuevos = errores = sin_novedad = 0
    for uid in personas:
        try:
            async with S() as db:
                r = await revisar_persona(db, uid, motor, gastar_motor=llamadas["n"] < MOTOR_MAX)
        except Exception as e:
            errores += 1
            print("error", uid, str(e)[:120])
            continue
        revisadas += 1
        if r.get("hay_nuevos"):
            con_nuevos += 1
            print("NUEVO", uid, [c["name"] for c in r["nuevos"]][-3:])
        elif not r.get("motor_llamado"):
            sin_novedad += 1
    async with S() as db:
        await db.execute(text("""
            DELETE FROM no_gente_vigilancia v WHERE NOT EXISTS (
                SELECT 1 FROM operational_matches m WHERE m.id = v.match_id
                  AND UPPER(COALESCE(m.status, '')) LIKE '%NO HAY GENTE%' AND COALESCE(TRIM(m.person_b), '') = '')
        """))
        await db.commit()
    print(f"{datetime.now():%Y-%m-%d %H:%M} personas={len(personas)} revisadas={revisadas} sin_gastar_motor={sin_novedad} consultas_al_motor={llamadas['n']} con_candidatas_nuevas={con_nuevos} errores={errores}")


asyncio.run(main())
