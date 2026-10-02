"""Crea los slots que les faltan a los clientes que ya existen (una fila 'Listo para match' por cada slot del plan que no tiene fila).
Uso: python crear_slots_faltantes.py [--aplicar]
Reglas:
- Solo clientes activos con citas restantes en su plan (las citas usadas no cuentan reprogramaciones, citas sin fecha ni no-shows sin penalidad).
- Las filas en rojo (NOT APPROVED, rechazos, trouble) NO ocupan slot: el cliente sigue necesitando su slot.
- Plan Estándar/Básico sin fecha de pago confirmada: se crean solo 2 slots (el tercero depende de la fecha y se decide con la revision de fechas).
- Cada fila creada lleva la marca [SLOT AJUSTE PLAN 2-oct] para poder revertirla.
"""
import asyncio, re, sys
from collections import Counter

sys.path.insert(0, "/app")
from sqlalchemy import text                                   # noqa: E402
from app.database import AsyncSessionLocal                    # noqa: E402
from app.routers import matchmaking as M                      # noqa: E402

APLICAR = "--aplicar" in sys.argv
MARCA = "[SLOT AJUSTE PLAN 2-oct]"
EXCLUIDOS = ("REFUND", "REFUND DONE", "DESCALIFICADO", "INACTIVO", "ARCHIVADO", "ENAMORADOS", "NO ACCEPT")
ROJOS = ("NOT APPROVED", "NO ACCEPT", "TROUBLE", "TROUBLEMAKER", "NO MATCH/CAMBIAR", "NO MATCH", "CAMBIAR")


def depende_de_fecha(plan: str) -> bool:
    return bool(re.search(r"65k|est.ndar|b.sico|40k", plan or "", re.I)) and not re.search(r"\(\d+\s*citas?\)|98k|plus", plan or "", re.I)


async def main():
    async with AsyncSessionLocal() as db:
        filas = (await db.execute(text("""
            SELECT m.id, m.user_id_a, m.person_a, m.psychologist_name, m.plan_tier, m.city, m.status, m.slot_number, m.person_a_crm_id,
                   p.last_payment_date, p.plan_tier AS plan_perfil, p.responsable
            FROM operational_matches m LEFT JOIN profiles p ON p.user_id = m.user_id_a
            WHERE m.user_id_a IS NOT NULL AND (m.batch_tag IS NULL OR m.batch_tag <> 'agosto27_backlog')
            ORDER BY m.user_id_a, m.id"""))).fetchall()
        usadas = {r[0]: r[1] for r in (await db.execute(text("""
            SELECT m.user_id_a, COUNT(DISTINCT sd.match_id) FROM scheduled_dates sd JOIN operational_matches m ON m.id = sd.match_id
            WHERE m.user_id_a IS NOT NULL AND sd.reschedule IS NOT TRUE AND COALESCE(sd.date_time, '') NOT ILIKE '%por definir%'
              AND (sd.feedback IS NULL OR sd.feedback NOT ILIKE '%NO-SHOW%' OR m.status ILIKE '%PENALIDAD%') GROUP BY m.user_id_a"""))).fetchall()}
        por = {}
        for r in filas:
            por.setdefault(r.user_id_a, []).append(r)
        a_crear, resumen, omitidos = [], Counter(), Counter()
        for uid, rows in por.items():
            ultima = rows[-1]
            if any((x.status or "").upper().strip() in EXCLUIDOS for x in rows):
                omitidos["con estado de salida (reembolso, descalificado, enamorados...)"] += 1
                continue
            plan = M.normalize_plan(ultima.plan_tier or ultima.plan_perfil)
            if not plan or (M.get_total_slots_by_plan(plan, ultima.last_payment_date) or 0) <= 0:
                omitidos["sin plan reconocido"] += 1
                continue
            citas = M.get_slots_by_plan(plan, ultima.last_payment_date) or 0
            restantes = max(0, citas - usadas.get(uid, 0))
            if restantes <= 0:
                omitidos["plan agotado"] += 1
                continue
            T = M.get_total_slots_by_plan(plan, ultima.last_payment_date) or 0
            if depende_de_fecha(plan) and not ultima.last_payment_date:
                T = min(T, 2)
            N = sum(1 for x in rows if (x.status or "").upper().strip() not in ROJOS)
            faltan = max(0, T - N)
            if faltan <= 0:
                omitidos["ya tiene todos sus slots"] += 1
                continue
            psi = ultima.psychologist_name or ultima.responsable
            if not psi:
                omitidos["sin psicologa"] += 1
                continue
            mx = max([x.slot_number or 0 for x in rows] + [0])
            for k in range(1, faltan + 1):
                a_crear.append({"uid": uid, "person_a": ultima.person_a, "psy": psi, "plan": ultima.plan_tier or plan, "city": ultima.city, "cid": ultima.person_a_crm_id, "slot": mx + k})
            resumen[M._mostrar_psicologa(psi)] += faltan
        print(f"clientes revisados: {len(por)} | filas a crear: {len(a_crear)} para {len({x['uid'] for x in a_crear})} clientes")
        print("por psicóloga actual:", dict(resumen.most_common()))
        print("omitidos:", dict(omitidos))
        if not APLICAR:
            print("SIMULACION (no se creó nada)")
            return
        for i in range(0, len(a_crear), 500):
            for x in a_crear[i:i + 500]:
                await db.execute(text("""INSERT INTO operational_matches (person_a, user_id_a, person_a_crm_id, psychologist_name, city, plan_tier, slot_number, status, approved_by_maria, observations, created_at, updated_at)
                    VALUES (:pa, :u, :cid, :psy, :city, :plan, :slot, 'Listo para match', false, :obs, NOW(), NOW())"""),
                                 {"pa": x["person_a"], "u": x["uid"], "cid": x["cid"], "psy": x["psy"], "city": x["city"], "plan": x["plan"], "slot": x["slot"], "obs": MARCA})
            await db.commit()
        print(f"APLICADO: {len(a_crear)} filas creadas con la marca {MARCA}")


asyncio.run(main())
