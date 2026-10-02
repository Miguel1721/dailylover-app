"""Recuperación automática de pagos de Stripe que el webhook no registró (vigilancia cada 30 min).

Registra el pago en stripe_payments y deja al cliente con su plan y su fecha de pago (igual que el webhook). NO envía correos, NO crea
recordatorios y NO toca Google Sheets; si el pago es del plan VIP de 650k deja un aviso URGENTE para que se envíe el enlace de agenda a mano.
Es idempotente (ON CONFLICT DO NOTHING) y reversible (metadata->>'recuperado').
"""
import asyncio
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

MARCA = "auto_vigilancia"
PLANES_IGNORADOS = ("Ticket de evento", "Pendiente de confirmar", "Recompra de cita")


async def recuperar_pagos_faltantes(db: AsyncSession, horas: int = 96) -> Dict[str, Any]:
    from app.routers.webhooks import STRIPE_PLAN_MAP
    from app.services.ops_watch import BOGOTA, _stripe_get

    def plan_de(pi, amount_cop, desc, meta):
        meta_plan = meta.get("plan_tier") or meta.get("plan") or meta.get("producto") or ""
        if "4gMcN4aqI87p4no2O48EM1g" in json.dumps(pi) or 640000 <= amount_cop <= 660000 or "650" in str(meta_plan) or "650" in desc:
            return "Matchmaking Service (3 citas)"
        if "experience" in (str(meta_plan) + desc).lower():
            return "Matchmaking Experience"
        if meta_plan:
            return meta_plan
        if desc and len(desc) > 3 and not desc.lower().startswith("invoice"):
            return desc[:60]
        if int(amount_cop) == 240000:
            return "VIP Done (matches ilimitados)"
        if int(amount_cop) == 30000:
            return "Recompra de cita"
        if int(amount_cop) == 50000:
            return "Pendiente de confirmar"
        if amount_cop and int(amount_cop) % 1000 == 0 and str(int(amount_cop) // 1000) in STRIPE_PLAN_MAP:
            return STRIPE_PLAN_MAP[str(int(amount_cop) // 1000)]
        return f"Plan Especial - ${int(amount_cop):,} COP" if amount_cop else "Plan Personalizado"

    desde = int((datetime.now(timezone.utc) - timedelta(hours=horas)).timestamp())
    corte = int((datetime.now(timezone.utc) - timedelta(minutes=20)).timestamp())      # margen para que el webhook alcance a registrar
    pis, after = [], None
    for _ in range(10):
        p: Dict[str, Any] = {"limit": 100, "created[gte]": desde, "expand[]": "data.latest_charge"}
        if after:
            p["starting_after"] = after
        d = await asyncio.to_thread(_stripe_get, "/v1/payment_intents", p)
        pis += d["data"]
        if not d.get("has_more"):
            break
        after = d["data"][-1]["id"]
    ok = [p for p in pis if p.get("status") == "succeeded" and p["created"] <= corte]
    have = {r[0] for r in (await db.execute(text("SELECT stripe_payment_intent_id FROM stripe_payments WHERE stripe_payment_intent_id IS NOT NULL"))).fetchall()}
    registrados, perfiles, vip = 0, 0, []
    for pi in [p for p in ok if p["id"] not in have]:
        ch = pi.get("latest_charge") if isinstance(pi.get("latest_charge"), dict) else {}
        bd = (ch or {}).get("billing_details") or {}
        meta = pi.get("metadata") or {}
        amount = (pi.get("amount_received") or pi.get("amount") or 0) / 100.0
        desc = str(pi.get("description") or "").strip()
        es_ticket = any(str(k).lower().startswith("luma") or str(k).lower() == "event_api_id" for k in meta)
        plan = "Ticket de evento" if es_ticket else plan_de(pi, amount, desc, meta)
        email = (bd.get("email") or pi.get("receipt_email") or "").strip().lower() or None
        uid = (await db.execute(text("SELECT id FROM users WHERE lower(email) = :e ORDER BY (crm_id IS NOT NULL) DESC, id LIMIT 1"), {"e": email})).scalar() if email else None
        fecha = datetime.fromtimestamp(pi["created"], BOGOTA).replace(tzinfo=None)
        r = await db.execute(text("""INSERT INTO stripe_payments (stripe_payment_intent_id, stripe_charge_id, stripe_customer_id, user_id, customer_name, customer_email, customer_phone,
                amount, currency, description, plan_tier, payment_status, payment_date, metadata, created_at, updated_at)
            VALUES (:pi_id, :ch_id, :cust_id, :uid, :name, :email, :phone, :amount, :currency, :desc, :plan, 'succeeded', :fecha, CAST(:meta AS jsonb), NOW(), NOW())
            ON CONFLICT (stripe_payment_intent_id) DO NOTHING"""),
                             dict(pi_id=pi["id"], ch_id=(ch or {}).get("id"), cust_id=pi.get("customer"), uid=uid, name=bd.get("name"), email=email, phone=bd.get("phone"), amount=amount,
                                  currency=(pi.get("currency") or "cop").upper(), desc=desc, plan=plan, fecha=fecha,
                                  meta=json.dumps({**meta, "recuperado": MARCA, "es_ticket_evento": es_ticket}, ensure_ascii=False)))
        if not (r.rowcount or 0):
            continue
        registrados += 1
        if uid and plan not in PLANES_IGNORADOS and not es_ticket:
            # el cliente queda con su plan y su fecha de pago (solo si este pago es más reciente que el que ya tenía)
            u = await db.execute(text("""UPDATE profiles SET plan_tier = :plan, last_payment_amount = :amt, last_payment_date = :f, stripe_customer_id = COALESCE(:c, stripe_customer_id), updated_at = NOW()
                WHERE user_id = :u AND (last_payment_date IS NULL OR last_payment_date <= :f)"""), {"plan": plan, "amt": amount, "f": fecha, "c": pi.get("customer"), "u": uid})
            perfiles += u.rowcount or 0
        if plan == "Matchmaking Service (3 citas)":
            vip.append(bd.get("name") or email or pi["id"])
    if vip:
        await db.execute(text("""INSERT INTO reminders (title, client_name, client_phone, priority, matchmaker, due_date, notes)
            VALUES (:t, 'SISTEMA', '', 'URGENTE', 'MPS', 'Hoy (URGENTE)', :n)"""),
                         {"t": "Pago VIP 650k recuperado: enviar el enlace de agenda", "n": "Estos pagos del plan VIP no llegaron por el webhook y el cliente NO recibió su enlace para agendar: " + ", ".join(vip)})
    await db.commit()
    return {"registrados": registrados, "perfiles_actualizados": perfiles, "vip_sin_enlace": vip}
