"""
Stripe Webhook Router for Daily Lover
Handles automatic plan upgrades, subscriptions, and payment events from Stripe.
"""

from fastapi import APIRouter, Request, HTTPException, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
import json
import logging

from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/webhooks", tags=["Webhooks"])

# Mapeo de IDs de productos / montos de Stripe a planes de Daily Lover
STRIPE_PLAN_MAP = {
    "195": "VIP 195k",
    "150": "Premium 150k",
    "98": "Estándar Plus 98k",
    "65": "Estándar 65k",
    "40": "Básico 40k",
}

@router.post("/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Endpoint automático para recibir eventos de pago desde Stripe.
    Actualiza el plan_tier del cliente y notifica a la psicóloga asignada.
    """
    try:
        payload = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = payload.get("type")
    data_object = payload.get("data", {}).get("object", {})

    logger.info(f"Stripe Webhook recibido: {event_type}")

    if event_type in ["checkout.session.completed", "invoice.payment_succeeded", "charge.succeeded"]:
        customer_email = data_object.get("customer_email") or data_object.get("billing_details", {}).get("email")
        customer_phone = data_object.get("customer_phone") or data_object.get("billing_details", {}).get("phone")
        amount_paid = data_object.get("amount_total") or data_object.get("amount")

        # Determinar el plan según el monto o metadata
        plan_name = "Estándar 65k"
        if data_object.get("metadata", {}).get("plan_tier"):
            plan_name = data_object["metadata"]["plan_tier"]
        elif amount_paid:
            amount_k = str(int(amount_paid / 100000))  # Convertir centavos de COP/USD
            for key, name in STRIPE_PLAN_MAP.items():
                if key in str(amount_paid):
                    plan_name = name
                    break

        if customer_email or customer_phone:
            # Buscar usuario en BD
            user_row = (await db.execute(text("""
                SELECT u.id, u.name, p.responsable, p.plan_tier
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                WHERE (u.email IS NOT NULL AND lower(u.email) = lower(:email))
                   OR (u.phone IS NOT NULL AND u.phone LIKE :phone)
                LIMIT 1
            """), {
                "email": customer_email or "",
                "phone": f"%{customer_phone[-7:]}%" if customer_phone else "NONE"
            })).fetchone()

            if user_row:
                user_id, user_name, responsable, old_plan = user_row

                # Actualizar plan_tier en profiles
                await db.execute(text("""
                    UPDATE profiles 
                    SET plan_tier = :plan_tier, updated_at = NOW()
                    WHERE user_id = :user_id
                """), {"plan_tier": plan_name, "user_id": user_id})

                # Registrar recordatorio / notificación interna para la psicóloga
                responsable_name = (responsable or "SILVI").replace("MATCHES ", "")
                obs_note = f"🔔 [PAGO AUTOMÁTICO STRIPE] {user_name} renovó/adquirió plan {plan_name}. Plan anterior: {old_plan or 'Sin plan'}."
                
                await db.execute(text("""
                    INSERT INTO reminders (title, description, due_date, status, assigned_to, created_at)
                    VALUES (:title, :desc, CURRENT_DATE, 'PENDIENTE', :assigned, NOW())
                """), {
                    "title": f"Pago Recibido: {user_name} ({plan_name})",
                    "desc": obs_note,
                    "assigned": responsable_name
                })

                await db.commit()
                logger.info(f"Plan actualizado para usuario {user_id} ({user_name}) a {plan_name}")
                return {"status": "success", "user_id": user_id, "updated_plan": plan_name}

    return {"status": "ignored", "event_type": event_type}


@router.post("/smartmatchapp")
async def smartmatchapp_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Endpoint automático para recibir sincronización en tiempo real desde SmartMatchApp.
    """
    try:
        payload = await request.json()
        logger.info(f"SmartMatchApp Webhook recibido: {payload.get('event', 'update')}")
        return {"status": "success", "message": "Event received successfully"}
    except Exception as e:
        logger.error(f"Error procesando webhook de SmartMatchApp: {e}")
        return {"status": "ok", "detail": str(e)}
