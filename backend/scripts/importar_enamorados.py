"""Importa las parejas de la hoja ENAMORADOS como estado ENAMORADOS en el sistema.
Uso: python importar_enamorados.py [--aplicar]     (sin --aplicar solo muestra lo que haria)
- Busca la fila de la pareja en operational_matches (A-B o B-A); si no existe la crea con la psicologa de la hoja.
- Marca ENAMORADOS con la misma regla del boton (guarda el estado anterior) y cierra los slots abiertos de ambas personas.
- Es repetible: una pareja ya marcada se salta.
"""
import asyncio, re, sys
from datetime import date

sys.path.insert(0, "/app/scripts"); sys.path.insert(0, "/app")
import sync_full_production_sheet as S                       # noqa: E402
from sqlalchemy import text                                   # noqa: E402
from app.database import AsyncSessionLocal                    # noqa: E402
from google.oauth2 import service_account                     # noqa: E402
from googleapiclient.discovery import build                   # noqa: E402
from app.services.psychologist_helper import resolve_canonical_psychologist as canon   # noqa: E402

APLICAR = "--aplicar" in sys.argv


async def main():
    creds = service_account.Credentials.from_service_account_file(S.resolve_creds_file(), scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
    svc = build("sheets", "v4", credentials=creds, cache_discovery=False)
    filas = svc.spreadsheets().values().get(spreadsheetId=S.ORIGINAL_SHEET_ID, range="'ENAMORADOS'!A1:K200").execute().get("values", [])
    pares = []
    for r in filas[1:]:
        if len(r) > 2 and str(r[1]).strip() and str(r[2]).strip():
            pares.append({"fecha": str(r[0]).strip(), "a": re.sub(r"\s+", " ", str(r[1])).strip(), "b": re.sub(r"\s+", " ", str(r[2])).strip(),
                          "nota": (str(r[4]).strip() if len(r) > 4 else ""), "matchmaker": (str(r[5]).strip() if len(r) > 5 else "")})
    print(f"pares en la hoja: {len(pares)}")
    resumen = {"ya_marcados": 0, "marcados": 0, "creados": 0, "sin_usuario": []}
    async with AsyncSessionLocal() as db:
        users = (await db.execute(text("SELECT id, name, email, phone, client_code, crm_id FROM users"))).fetchall()
        res = S.UserCascadeResolver(users)
        for p in pares:
            ua, _, _ = res.resolve(p["a"])
            ub, _, _ = res.resolve(p["b"])
            if not ua or not ub:
                resumen["sin_usuario"].append(f"{p['a']} / {p['b']} ({'A' if not ua else ''}{'B' if not ub else ''} sin usuario)")
                continue
            f = (await db.execute(text("""SELECT id, status, observations FROM operational_matches
                WHERE (user_id_a = :a AND user_id_b = :b) OR (user_id_a = :b AND user_id_b = :a) ORDER BY (UPPER(status) = 'ENAMORADOS') DESC, id DESC LIMIT 1"""), {"a": ua, "b": ub})).fetchone()
            nota = f"Importado de la hoja ENAMORADOS (cuadre {p['fecha']})" + (f": {p['nota']}" if p["nota"] else "")
            if f and (f.status or "").upper() == "ENAMORADOS":
                resumen["ya_marcados"] += 1
                continue
            if not APLICAR:
                resumen["creados" if not f else "marcados"] += 1
                continue
            if not f:
                psy = canon(p["matchmaker"]) or (p["matchmaker"] or "").strip().upper()
                row = (await db.execute(text("""INSERT INTO operational_matches (person_a, user_id_a, person_b, user_id_b, psychologist_name, status, approved_by_maria, observations, created_at, updated_at)
                    SELECT ua.name, ua.id, ub.name, ub.id, :psy, 'CITA REALIZADA', true, '', NOW(), NOW() FROM users ua, users ub WHERE ua.id = :a AND ub.id = :b RETURNING id"""),
                                         {"a": ua, "b": ub, "psy": psy})).scalar()
                resumen["creados"] += 1
                mid, antes = row, "CITA REALIZADA"
            else:
                mid, antes = f.id, f.status
                resumen["marcados"] += 1
            await db.execute(text("UPDATE operational_matches SET status = 'ENAMORADOS', observations = COALESCE(observations, '') || :o, updated_at = NOW() WHERE id = :i"),
                             {"i": mid, "o": f" [ENAMORADOS: antes {antes}] {nota}"})
            abiertos = (await db.execute(text("""SELECT id, status FROM operational_matches WHERE user_id_a = ANY(:u) AND id <> :i AND (person_b IS NULL OR TRIM(person_b) = '')
                AND UPPER(COALESCE(status, '')) IN ('LISTO PARA MATCH', 'NO HAY GENTE', 'BORRADOR', 'PENDIENTE')"""), {"u": [ua, ub], "i": mid})).fetchall()
            for r in abiertos:
                await db.execute(text("UPDATE operational_matches SET status = 'ENAMORADOS', observations = COALESCE(observations, '') || :o, updated_at = NOW() WHERE id = :i"),
                                 {"i": r.id, "o": f" [ENAMORADOS: antes {r.status}]"})
            for n in (p["a"], p["b"]):
                await db.execute(text("INSERT INTO person_history (person_name, match_id, event_type, details, created_at) VALUES (:n, :m, 'ENAMORADOS', :d, NOW())"), {"n": n, "m": mid, "d": nota})
        if APLICAR:
            await db.commit()
    print(("APLICADO" if APLICAR else "SIMULACION"), {k: (v if not isinstance(v, list) else len(v)) for k, v in resumen.items()})
    for x in resumen["sin_usuario"]:
        print("  sin usuario:", x)


asyncio.run(main())
