"""Guarda en profiles.plan_fecha_pago la fecha de pago del plan de los clientes cuya fecha es CONFIABLE (lee fechas_de_pago_conciliadas.csv).
Uso: python aplicar_fechas_pago.py [--aplicar]
Se aplica: Stripe, dos fuentes que coinciden, o una sola fuente (CRM, VOLVIO A PAGAR, 650 k) fuera de la zona gris (1 al 10 de mayo).
NO se aplica: fuentes que se contradicen, sin dato, zona gris, hoja PROFILES como unica fuente, y los casos donde la fecha guardada
y la propuesta caen en lados distintos del 1-may (quedan en fechas_de_pago_a_revisar.csv).
No toca last_payment_date; la regla de slots usa last_payment_date y, si no hay, plan_fecha_pago.
"""
import asyncio, csv, sys
from collections import Counter
from datetime import date

sys.path.insert(0, "/app")
from sqlalchemy import text                                   # noqa: E402
from app.database import AsyncSessionLocal                    # noqa: E402

APLICAR = "--aplicar" in sys.argv
CORTE = "2026-05-01"


def decidir(x):
    f, conf, fuente = x["fecha_propuesta"], x["confianza"], x["fuente_de_la_propuesta"]
    if not f:
        return None, "sin dato"
    if conf.startswith("BAJA"):
        return None, "las fuentes se contradicen"
    if x["fecha_guardada_en_sistema"] and (x["fecha_guardada_en_sistema"] < CORTE) != (f < CORTE) and x["depende_de_la_fecha"] == "SI":
        return None, "la fecha guardada y la propuesta caen en lados distintos del 1-may"
    if conf.startswith("ALTA"):
        return f, "ALTA"
    if "PROFILES" in fuente:
        return None, "solo la hoja PROFILES (no es fecha de pago segura)"
    if "2026-05-01" <= f <= "2026-05-10":
        return None, "zona gris (registro del 1 al 10 de mayo: pudo pagar en abril)"
    return f, "MEDIA"


async def main():
    filas = list(csv.DictReader(open("/app/exports/fechas_de_pago_conciliadas.csv", encoding="utf-8-sig")))
    aplicar, revisar, cnt = [], [], Counter()
    for x in filas:
        f, motivo = decidir(x)
        if f:
            aplicar.append((int(x["user_id"]), f, x["fuente_de_la_propuesta"], motivo))
            cnt["aplicar " + motivo] += 1
        else:
            revisar.append({**{k: x[k] for k in ("user_id", "cliente", "responsable", "plan", "depende_de_la_fecha", "fecha_guardada_en_sistema", "fecha_stripe_ultima", "fecha_crm_registro", "fecha_hoja_profiles", "fecha_hoja_volvio_a_pagar", "fecha_propuesta", "fuente_de_la_propuesta")}, "motivo_para_revisar": motivo})
            cnt["revisar: " + motivo] += 1
    print("clientes:", len(filas), dict(cnt))
    dep = [x for x in filas if x["depende_de_la_fecha"] == "SI"]
    ap_ids = {a[0] for a in aplicar}
    print("de los 'dependen de la fecha':", len(dep), "| se aplican:", sum(1 for x in dep if int(x["user_id"]) in ap_ids), "| quedan por revisar:", sum(1 for x in dep if int(x["user_id"]) not in ap_ids))
    with open("/app/exports/fechas_de_pago_a_revisar.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(revisar[0].keys()))
        w.writeheader()
        w.writerows(sorted(revisar, key=lambda r: (r["depende_de_la_fecha"] != "SI", r["motivo_para_revisar"], r["cliente"])))
    if not APLICAR:
        print("SIMULACION (no se cambio nada)")
        return
    async with AsyncSessionLocal() as db:
        await db.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_fecha_pago DATE"))
        await db.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_fecha_fuente TEXT"))
        await db.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_fecha_confianza TEXT"))
        await db.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_fecha_aplicada_en TIMESTAMP"))
        n = 0
        for uid, f, fuente, conf in aplicar:
            await db.execute(text("""UPDATE profiles SET plan_fecha_pago = :f, plan_fecha_fuente = :s, plan_fecha_confianza = :c, plan_fecha_aplicada_en = NOW()
                WHERE user_id = :u AND plan_fecha_pago IS NULL"""), {"f": date.fromisoformat(f), "s": fuente, "c": conf, "u": uid})
            n += 1
        await db.commit()
        print(f"APLICADO: {n} clientes con plan_fecha_pago")


asyncio.run(main())
