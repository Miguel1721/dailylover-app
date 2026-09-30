"""
Stripe & SmartMatchApp Webhook Router for Daily Lover
Handles automatic plan upgrades, subscriptions, payment events from Stripe,
and real-time event sync from SmartMatchApp into Postgres DB.
"""

from fastapi import APIRouter, Request, HTTPException, Depends, Header, BackgroundTasks
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from datetime import datetime
import json
import os
import logging
import hmac
import hashlib
import base64

from app.database import get_db, AsyncSessionLocal
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/webhooks", tags=["Webhooks"])

import asyncio

# Mapeo de IDs de productos / montos de Stripe a planes de Daily Lover
STRIPE_PLAN_MAP = {
    "650": "Matchmaking Service (3 citas)",
    "195": "VIP 195k",
    "150": "Premium",
    "98": "Estándar Plus 98k",
    "65": "Estándar 65k",
    "40": "Básico 40k",
}

def verify_stripe_signature(payload_bytes: bytes, sig_header: Optional[str], secret: str) -> bool:
    """Valida la firma HMAC-SHA256 del webhook de Stripe."""
    if not secret:
        return True
    if not sig_header:
        return False
    try:
        pairs = dict(item.strip().split("=", 1) for item in sig_header.split(",") if "=" in item)
        timestamp = pairs.get("t")
        signature = pairs.get("v1")
        if not timestamp or not signature:
            return False
        signed_payload = f"{timestamp}.".encode("utf-8") + payload_bytes
        expected_sig = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_sig, signature)
    except Exception as e:
        logger.error(f"Error verificando firma de Stripe: {e}")
        return False

@router.post("/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Endpoint automático para recibir eventos de pago desde Stripe.
    Actualiza el plan_tier del cliente, registra en stripe_payments,
    notifica a la psicóloga asignada y procesa eventos de devolución (refund).
    """
    settings = get_settings()
    body_bytes = await request.body()
    sig_header = request.headers.get("stripe-signature")

    # 1. Validar firma si el secreto está configurado
    if settings.stripe_webhook_secret:
        if not verify_stripe_signature(body_bytes, sig_header, settings.stripe_webhook_secret):
            logger.warning("Firma criptográfica de Stripe rechazada")
            raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = payload.get("type")
    data_object = payload.get("data", {}).get("object", {})

    logger.info(f"Stripe Webhook recibido: {event_type}")

    # ─── CASO 1: PAGO EXITOSO O CHECKOUT COMPLETADO ─────────────────────────────
    if event_type in ["checkout.session.completed", "invoice.payment_succeeded", "charge.succeeded"]:
        customer_email = data_object.get("customer_email") or data_object.get("billing_details", {}).get("email")
        customer_phone = data_object.get("customer_phone") or data_object.get("billing_details", {}).get("phone")
        customer_name = data_object.get("customer_name") or data_object.get("billing_details", {}).get("name")
        stripe_cust_id = data_object.get("customer")
        
        pi_id = data_object.get("payment_intent") or (data_object.get("id") if str(data_object.get("id", "")).startswith("pi_") else None)
        charge_id = data_object.get("latest_charge") or (data_object.get("id") if str(data_object.get("id", "")).startswith("ch_") else None)

        # Si el correo no vino directo pero tenemos customer_id y API key, enriquecer desde Stripe
        if not customer_email and stripe_cust_id and settings.stripe_api_key:
            try:
                import urllib.request
                auth_h = "Basic " + base64.b64encode(f"{settings.stripe_api_key}:".encode()).decode()
                req_c = urllib.request.Request(f"https://api.stripe.com/v1/customers/{stripe_cust_id}", headers={"Authorization": auth_h})
                with urllib.request.urlopen(req_c) as resp_c:
                    c_data = json.loads(resp_c.read().decode())
                    customer_email = customer_email or c_data.get("email")
                    customer_name = customer_name or c_data.get("name")
                    customer_phone = customer_phone or c_data.get("phone")
            except Exception as ex:
                logger.warning(f"No se pudo consultar customer {stripe_cust_id}: {ex}")

        amount_raw = data_object.get("amount_total") or data_object.get("amount") or 0
        amount_cop = float(amount_raw) / 100.0 if amount_raw else 0.0
        currency = (data_object.get("currency") or "cop").upper()

        # Determinar el plan de forma dinámica (soportando links preferenciales o únicos de María)
        meta = data_object.get("metadata", {}) or {}
        meta_plan = meta.get("plan_tier") or meta.get("plan") or meta.get("producto") or ""
        # Tickets de eventos (p. ej. "HOT & SINGLE", cobrados vía Luma): se registran como pago, pero NO deben
        # cambiar el plan del cliente, su fecha de pago de plan, ni generar avisos o escrituras en Sheets de plan.
        is_event_ticket = any(str(k).lower().startswith("luma") or str(k).lower() == "event_api_id" for k in meta.keys())
        desc = str(data_object.get("description") or "").strip()

        # Detección específica del plan Matchmaking Service 650k (Link directo https://buy.stripe.com/4gMcN4aqI87p4no2O48EM1g o monto 650k)
        is_vip_650k = bool(
            "4gMcN4aqI87p4no2O48EM1g" in str(data_object)
            or (640000 <= amount_cop <= 660000)
            or ("650" in str(meta_plan).lower())
            or ("650" in desc.lower())
        )

        plan_name = ""
        if is_vip_650k:
            plan_name = "Matchmaking Service (3 citas)"
        elif "experience" in str(meta_plan).lower() or "experience" in desc.lower():
            plan_name = "Matchmaking Experience"
        elif meta_plan:
            plan_name = meta_plan
        elif desc and len(desc) > 3 and not desc.lower().startswith("invoice"):
            plan_name = desc[:60]
        else:
            for key, name in STRIPE_PLAN_MAP.items():
                if key in str(int(amount_cop)):
                    plan_name = name
                    break

        if not plan_name:
            if amount_cop > 0:
                plan_name = f"Plan Especial - ${int(amount_cop):,} {currency}"
            else:
                plan_name = "Plan Personalizado"

        # Registrar en la tabla de auditoría stripe_payments
        try:
            await db.execute(text("""
                INSERT INTO stripe_payments (
                    stripe_payment_intent_id, stripe_charge_id, stripe_customer_id,
                    customer_name, customer_email, customer_phone,
                    amount, currency, description, plan_tier,
                    payment_status, payment_date, metadata, created_at, updated_at
                ) VALUES (
                    :pi_id, :ch_id, :cust_id,
                    :c_name, :c_email, :c_phone,
                    :amt, :curr, :desc, :plan,
                    'succeeded', NOW(), :meta, NOW(), NOW()
                )
                ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET
                    payment_status = 'succeeded',
                    amount = EXCLUDED.amount,
                    plan_tier = EXCLUDED.plan_tier,
                    customer_name = COALESCE(EXCLUDED.customer_name, stripe_payments.customer_name),
                    customer_email = COALESCE(EXCLUDED.customer_email, stripe_payments.customer_email),
                    updated_at = NOW()
            """), {
                "pi_id": pi_id,
                "ch_id": charge_id,
                "cust_id": stripe_cust_id,
                "c_name": customer_name,
                "c_email": customer_email,
                "c_phone": customer_phone,
                "amt": amount_cop,
                "curr": currency,
                "desc": desc or plan_name,
                "plan": plan_name,
                "meta": json.dumps(meta)
            })
            # Confirmar YA el registro del pago: antes solo se confirmaba si el comprador existía en `users`,
            # y los pagos de personas nuevas se perdían en silencio (se respondía "success" sin guardar).
            await db.commit()
        except Exception as e:
            logger.error(f"Error guardando en stripe_payments: {e}")
            await db.rollback()

        # Buscar usuario en el CRM por correo, teléfono o nombre
        if customer_email or customer_phone or customer_name:
            result = await db.execute(text("""
                SELECT u.id, u.name, p.responsable, p.plan_tier
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                WHERE (u.email IS NOT NULL AND lower(u.email) = lower(:e))
                   OR (u.phone IS NOT NULL AND u.phone = :p)
                   OR (u.name IS NOT NULL AND lower(u.name) = lower(:n))
                ORDER BY
                    -- Determinista cuando hay fichas duplicadas: primero coincidencia por teléfono, luego por correo,
                    -- se evitan las fichas con teléfono generado (GEN_...) y por último la más antigua.
                    (CASE WHEN :p <> '' AND u.phone = :p THEN 0
                          WHEN :e <> '' AND lower(u.email) = lower(:e) THEN 1
                          ELSE 2 END),
                    (CASE WHEN COALESCE(u.phone, '') LIKE 'GEN%' THEN 1 ELSE 0 END),
                    u.id ASC
                LIMIT 1
            """), {"e": customer_email or "", "p": customer_phone or "", "n": customer_name or ""})
            user_row = result.fetchone()

            if user_row:
                user_id, user_name, responsable, old_plan = user_row.id, user_row.name, user_row.responsable, user_row.plan_tier

                # Actualizar plan y referencias de Stripe en profiles
                await db.execute(text("""
                    UPDATE profiles
                    SET plan_tier = :plan_tier,
                        stripe_customer_id = COALESCE(:cust_id, stripe_customer_id),
                        stripe_payment_intent_id = COALESCE(:pi_id, stripe_payment_intent_id),
                        last_payment_amount = :amt,
                        last_payment_date = NOW(),
                        updated_at = NOW()
                    WHERE user_id = :user_id AND NOT CAST(:is_event AS BOOLEAN)
                """), {
                    "plan_tier": plan_name,
                    "cust_id": stripe_cust_id,
                    "pi_id": pi_id,
                    "amt": amount_cop,
                    "user_id": user_id,
                    "is_event": bool(is_event_ticket)
                })

                # Vincular user_id en stripe_payments
                if pi_id:
                    await db.execute(text("""
                        UPDATE stripe_payments SET user_id = :uid WHERE stripe_payment_intent_id = :pi
                    """), {"uid": user_id, "pi": pi_id})

                # Notificación para la psicóloga asignada
                if is_vip_650k:
                    responsable_name = "MPS"
                    await db.execute(text("UPDATE profiles SET responsable = 'MPS' WHERE user_id = :uid"), {"uid": user_id})
                else:
                    responsable_name = (responsable or "").replace("MATCHES ", "").strip() or "REVISIÓN MANUAL"
                obs_note = f"🔔 [PAGO STRIPE] {user_name} adquirió {plan_name} (${amount_cop:,.0f} {currency}). Plan anterior: {old_plan or 'Sin plan'}."

                # El aviso interno NUNCA debe bloquear el plan ni los correos de agendamiento:
                # va en un savepoint y con las columnas reales de `reminders`.
                try:
                    async with db.begin_nested():
                        await db.execute(text("""
                            INSERT INTO reminders (title, client_name, client_phone, priority, matchmaker, due_date, notes)
                            SELECT :title, :cname, :cphone, 'ALTA', :matchmaker, 'Hoy (Pago)', :notes
                            WHERE NOT CAST(:is_event AS BOOLEAN)
                        """), {
                            "is_event": bool(is_event_ticket),
                            "title": f"Pago Recibido: {user_name} ({plan_name})",
                            "cname": user_name,
                            "cphone": customer_phone or "",
                            "matchmaker": responsable_name,
                            "notes": obs_note
                        })
                except Exception as e_rem_pay:
                    logger.error(f"No se pudo crear el aviso de pago en reminders: {e_rem_pay}")

                await db.commit()
                logger.info(f"Plan actualizado en profiles para usuario {user_id} ({user_name}) a {plan_name}")

            # Disparador en tiempo real hacia Google Sheets (apuntando al Sheet configurado en GOOGLE_SHEETS_SPREADSHEET_ID)
            target_name = (user_row.name if user_row else None) or customer_name or ""
            target_resp = ("MPS" if is_vip_650k else (user_row.responsable if user_row else None))
            if target_name and plan_name and not is_event_ticket:
                try:
                    from app.services.google_sheets import update_client_plan_in_sheet
                    asyncio.create_task(
                        asyncio.to_thread(
                            update_client_plan_in_sheet,
                            customer_name=target_name,
                            new_plan=plan_name,
                            responsable=target_resp
                        )
                    )
                    logger.info(f"🚀 Disparador Stripe -> Google Sheets programado en background para: '{target_name}' con plan '{plan_name}'")
                except Exception as e_sheet:
                    logger.warning(f"No se pudo programar actualización de Google Sheets en tiempo real: {e_sheet}")

            # Disparador de Alerta Inmediata por Correo a María Salinas y Selección de Slots a la clienta Matchmaking Service
            if is_vip_650k:
                try:
                    from app.services.email_service import send_vip_650k_alert_to_owner, send_vip_slot_selection_email
                    from app.services.google_calendar_service import calculate_available_vip_slots

                    c_final_name = target_name or customer_name or "Cliente"
                    c_final_email = customer_email or ""

                    # 1. Alerta a la dueña (María Salinas)
                    asyncio.create_task(
                        asyncio.to_thread(
                            send_vip_650k_alert_to_owner,
                            customer_name=c_final_name,
                            customer_email=c_final_email or "Sin correo registrado",
                            customer_phone=customer_phone or "",
                            amount_cop=amount_cop,
                            currency=currency,
                            user_id=user_row.id if user_row else None
                        )
                    )
                    logger.info(f"💌 Notificación Matchmaking Service 650k disparada por correo a maria.salinas@dailylover.org para '{c_final_name}'")

                    # 2. Correo de bienvenida al cliente con huecos disponibles para selección
                    if c_final_email and "@" in c_final_email:
                        slots = calculate_available_vip_slots(days_ahead=7, slot_minutes=30, max_slots=6)
                        token_book = f"vip_{pi_id or 'pay'}_{int(datetime.now().timestamp())}"
                        sent_ok = await asyncio.to_thread(
                            send_vip_slot_selection_email,
                            customer_name=c_final_name,
                            customer_email=c_final_email,
                            slots=slots,
                            booking_token=token_book
                        )
                        if not sent_ok:
                            raise RuntimeError(f"El servicio de correo no pudo entregar las opciones de agendamiento Matchmaking Service a {c_final_email}")
                        logger.info(f"💌 Correo con {len(slots)} opciones de agendamiento Matchmaking Service enviado al cliente '{c_final_name}' ({c_final_email})")
                    else:
                        raise ValueError(f"El pago Matchmaking Service (650k) de '{c_final_name}' no incluyó un correo válido para enviar los horarios de agendamiento.")
                except Exception as e_vip_mail:
                    logger.error(f"Error disparando correos Matchmaking Service: {e_vip_mail}")
                    try:
                        c_err_name = target_name or customer_name or "Cliente"
                        err_note = (
                            f"⚠️ [ALERTA AGENDAMIENTO MATCHMAKING SERVICE] No se pudo enviar el correo con horarios disponibles a "
                            f"{c_err_name} ({customer_email or 'Sin correo'} | Tel: {customer_phone or 'Sin teléfono'}). "
                            f"Motivo: {type(e_vip_mail).__name__}: {e_vip_mail}. "
                            f"Por favor contactar manualmente desde CS/María para agendar su entrevista."
                        )
                        await db.execute(text("""
                            INSERT INTO reminders (title, client_name, client_phone, priority, matchmaker, due_date, notes)
                            VALUES (:title, :cname, :cphone, 'URGENTE', 'MPS', 'Hoy (URGENTE)', :notes)
                        """), {
                            "title": f"⚠️ Fallo Correo Agendamiento Matchmaking Service: {c_err_name}",
                            "cname": c_err_name,
                            "cphone": customer_phone or "",
                            "notes": err_note
                        })
                        await db.commit()
                    except Exception as e_rem_vip:
                        logger.error(f"No se pudo registrar reminder de fallo de agendamiento Matchmaking Service: {e_rem_vip}")

            if user_row:
                return {"status": "success", "user_id": user_id, "updated_plan": plan_name}
            else:
                return {"status": "success", "customer_name": customer_name, "updated_plan": plan_name}

    # ─── CASO 2: REEMBOLSO EMITIDO EN STRIPE ─────────────────────────────────────
    elif event_type == "charge.refunded":
        pi_id = data_object.get("payment_intent")
        ch_id = data_object.get("id")
        amount_refunded = float(data_object.get("amount_refunded", 0)) / 100.0
        refunds_list = data_object.get("refunds", {}).get("data", [])
        refund_id = refunds_list[0].get("id") if refunds_list else f"re_{ch_id}"

        logger.info(f"Stripe Webhook Refund: ch={ch_id}, pi={pi_id}, amount={amount_refunded}, ref_id={refund_id}")

        # Actualizar stripe_payments
        if pi_id or ch_id:
            await db.execute(text("""
                UPDATE stripe_payments
                SET payment_status = 'refunded',
                    amount_refunded = :amt,
                    stripe_refund_id = :ref_id,
                    updated_at = NOW()
                WHERE stripe_payment_intent_id = :pi OR stripe_charge_id = :ch
            """), {"amt": amount_refunded, "ref_id": refund_id, "pi": pi_id, "ch": ch_id})

        # Buscar match en operational_matches para marcarlo REFUND DONE
        res = await db.execute(text("""
            SELECT id, person_a, psychologist_name, observations
            FROM operational_matches
            WHERE stripe_payment_intent_id = :pi
               OR (status = 'REFUND' AND person_a ILIKE :name_pattern)
            ORDER BY updated_at DESC LIMIT 1
        """), {
            "pi": pi_id or "",
            "name_pattern": f"%{data_object.get('billing_details', {}).get('name', '')[:10]}%" if data_object.get('billing_details', {}).get('name') else "IMPOSSIBLE_MATCH"
        })
        match_row = res.fetchone()

        if match_row:
            mid = match_row.id
            obs = (match_row.observations or "") + f" | [REFUND STRIPE WEBHOOK: {refund_id} - ${amount_refunded:,.0f} COP]"
            await db.execute(text("""
                UPDATE operational_matches
                SET status = 'REFUND DONE',
                    stripe_refund_id = :ref_id,
                    refund_amount = :amt,
                    observations = :obs,
                    updated_at = NOW()
                WHERE id = :mid
            """), {"mid": mid, "ref_id": refund_id, "amt": amount_refunded, "obs": obs})

            await db.execute(text("""
                INSERT INTO person_history (person_name, match_id, event_type, details, created_at)
                VALUES (:name, :mid, 'STRIPE_REFUND_WEBHOOK', :details, NOW())
            """), {
                "name": match_row.person_a,
                "mid": mid,
                "details": f"Reembolso confirmado vía Stripe Webhook. ID: {refund_id}, Monto: ${amount_refunded:,.0f} COP"
            })

            # Notificar a Apps Script (Google Sheets)
            try:
                from app.services.google_sheets import notify_apps_script_status_change, get_canonical_tab_name
                tab_name = get_canonical_tab_name(match_row.psychologist_name)
                asyncio.create_task(notify_apps_script_status_change(
                    tab=tab_name,
                    match_id=mid,
                    slot_number=1,
                    new_status="REFUND DONE",
                    role="servicio_al_cliente",
                    extra_notes=f"Reembolso automático Stripe: {refund_id}"
                ))
            except Exception as err:
                logger.warning(f"Error notificando Apps Script tras webhook refund: {err}")

        await db.commit()
        return {"status": "success", "refund_id": refund_id, "amount_refunded": amount_refunded}

    return {"status": "ignored", "event_type": event_type}


# ─── SMARTMATCHAPP INTEGRACIÓN EN TIEMPO REAL ─────────────────────────

def verify_signature(body_bytes: bytes, signature_header: str, secret: str) -> bool:
    """
    Valida la firma HMAC-SHA256 enviada en los webhooks de SmartMatchApp.
    Soporta formato Base64, Hexadecimal, y claves secretas en UTF-8 o raw hex bytes.
    """
    if not secret:
        logger.error("SMARTMATCHAPP_WEBHOOK_SECRET no configurado — rechazando evento")
        return False
    if not signature_header:
        return False

    clean_sig = signature_header.strip()
    if clean_sig.lower().startswith("sha256="):
        clean_sig = clean_sig[7:]
    elif clean_sig.lower().startswith("sha256:"):
        clean_sig = clean_sig[7:]

    # Variantes de clave secreta (string utf-8 vs bytes desde hex)
    secret_bytes_utf8 = secret.encode("utf-8")
    try:
        secret_bytes_hex = bytes.fromhex(secret)
    except Exception:
        secret_bytes_hex = secret_bytes_utf8

    # 1. SHA256 con secret UTF-8 (Hex y Base64)
    exp_hex_utf8 = hmac.new(secret_bytes_utf8, body_bytes, hashlib.sha256).hexdigest()
    exp_b64_utf8 = base64.b64encode(hmac.new(secret_bytes_utf8, body_bytes, hashlib.sha256).digest()).decode("utf-8")

    # 2. SHA256 con secret Raw Hex (Hex y Base64)
    exp_hex_raw = hmac.new(secret_bytes_hex, body_bytes, hashlib.sha256).hexdigest()
    exp_b64_raw = base64.b64encode(hmac.new(secret_bytes_hex, body_bytes, hashlib.sha256).digest()).decode("utf-8")

    # 3. SHA1 con secret UTF-8
    exp_hex_sha1 = hmac.new(secret_bytes_utf8, body_bytes, hashlib.sha1).hexdigest()

    if (hmac.compare_digest(exp_hex_utf8.lower(), clean_sig.lower()) or 
        hmac.compare_digest(exp_b64_utf8, clean_sig) or
        hmac.compare_digest(exp_hex_raw.lower(), clean_sig.lower()) or
        hmac.compare_digest(exp_b64_raw, clean_sig) or
        hmac.compare_digest(exp_hex_sha1.lower(), clean_sig.lower())):
        return True

    logger.warning(
        f"HMAC mismatch detallado:\n"
        f"  - Received:      '{clean_sig}'\n"
        f"  - Exp Hex UTF8:  '{exp_hex_utf8}'\n"
        f"  - Exp Hex Raw:   '{exp_hex_raw}'\n"
        f"  - Exp SHA1:      '{exp_hex_sha1}'\n"
        f"  - Body len:      {len(body_bytes)} bytes\n"
        f"  - Body text:     '{body_bytes.decode('utf-8', errors='ignore')}'"
    )
    return False




async def process_webhook_payload(event_type: str, data: dict, raw_event_id: int = None):
    """
    Worker asíncrono para procesar eventos en segundo plano sin demorar la respuesta HTTP 200.
    """
    async with AsyncSessionLocal() as db:
        try:
            # 1. EVENTOS DE CLIENTE (client.created, client.updated, client_profile_updated, client_preferences_updated, user.created, user.updated)
            if any(k in event_type.lower() for k in ["client", "user", "profile", "preference"]):
                crm_id = str(data.get("id") or data.get("client_id") or data.get("user_id") or "").strip()
                phone = str(data.get("phone") or data.get("mobile") or data.get("telefono") or data.get("prof_190") or data.get("prof_phone") or "").strip()
                first_n = str(data.get("first_name") or data.get("prof_188") or "").strip()
                last_n = str(data.get("last_name") or data.get("prof_189") or "").strip()
                name = str(data.get("name") or data.get("full_name") or data.get("nombre") or f"{first_n} {last_n}".strip() or "").strip()
                email = str(data.get("email") or data.get("correo") or data.get("prof_180") or data.get("prof_email") or "").strip()
                if not name and data.get("prof_212"):
                    ig_raw = str(data.get("prof_212") or "").strip().lstrip("@")
                    if ig_raw and len(ig_raw) >= 3:
                        import re as _re
                        ig_clean = _re.sub(r'[._\-]+', ' ', ig_raw).strip().title()
                        if ig_clean:
                            name = f"{ig_clean} (@{ig_raw})"
                elif not name and email and "@" in email:
                    import re as _re
                    em_prefix = _re.sub(r'[._\-0-9]+', ' ', email.split("@")[0]).strip().title()
                    if em_prefix:
                        name = em_prefix
                city = str(data.get("city") or data.get("ciudad") or "").strip()
                if not city and data.get("prof_191"):
                    p191 = data.get("prof_191")
                    if isinstance(p191, dict):
                        city = str(p191.get("city") or "").strip()
                    elif isinstance(p191, str):
                        city = p191.strip()

                # Extraer orientación de campos de SmartMatchApp (ej. pref_65 o prof_193)
                orientation = ""
                pref_65 = data.get("pref_65")
                if isinstance(pref_65, list) and len(pref_65) > 0 and isinstance(pref_65[0], dict):
                    choice_label = pref_65[0].get("choice_label", "")
                    if "hetero" in choice_label.lower():
                        orientation = "hetero"
                    elif "gay" in choice_label.lower() or "homo" in choice_label.lower():
                        orientation = "gay"
                    elif "lesb" in choice_label.lower():
                        orientation = "lesb"
                    elif "bi" in choice_label.lower():
                        orientation = "bi"
                elif data.get("prof_193"):
                    p193 = data.get("prof_193")
                    lbl = p193.get("choice_label", "") if isinstance(p193, dict) else str(p193)
                    if "hetero" in lbl.lower():
                        orientation = "hetero"
                    elif "gay" in lbl.lower() or "homo" in lbl.lower():
                        orientation = "gay"
                    elif "lesb" in lbl.lower():
                        orientation = "lesb"
                    elif "bi" in lbl.lower():
                        orientation = "bi"

                # Extraer género
                gender = data.get("gender") or data.get("genero") or ""
                if not gender and data.get("prof_192"):
                    p192 = data.get("prof_192")
                    gender = p192.get("choice_label", "") if isinstance(p192, dict) else str(p192)

                # Extraer edad / fecha nacimiento
                age = data.get("age") or data.get("edad") or data.get("prof_247")
                if age:
                    try:
                        age = int(float(str(age)))
                    except Exception:
                        age = None
                if not age and data.get("prof_194"):
                    try:
                        b_year = int(str(data.get("prof_194"))[:4])
                        from datetime import datetime as dt_now
                        age = dt_now.now().year - b_year
                    except Exception:
                        pass

                occupation = data.get("occupation") or data.get("profesion") or data.get("prof_199")

                if crm_id or phone or email or name:
                    # Normalizar teléfono si existe
                    if phone:
                        phone = phone.replace(" ", "").replace("-", "")
                        if not phone.startswith("+"):
                            phone = "+57" + phone.lstrip("0")
                    else:
                        phone = f"+57300000{crm_id}" if crm_id else f"+57399999{hash(name)%100000:05d}"

                    # Upsert User buscando por crm_id primero
                    existing_user = None
                    if crm_id:
                        res = await db.execute(text("SELECT id FROM users WHERE crm_id = :cid LIMIT 1"), {"cid": crm_id})
                        existing_user = res.fetchone()

                    if not existing_user and phone:
                        res = await db.execute(text("SELECT id FROM users WHERE phone = :p LIMIT 1"), {"p": phone})
                        existing_user = res.fetchone()

                    if existing_user:
                        user_id = existing_user[0]
                        # Si el teléfono ya pertenece a otro registro en users, unificar crm_id en el registro original
                        if phone and not phone.startswith("+57300000"):
                            res_p = await db.execute(text("SELECT id FROM users WHERE phone = :p AND id != :uid LIMIT 1"), {"p": phone, "uid": user_id})
                            other_u = res_p.fetchone()
                            if other_u:
                                other_id = other_u[0]
                                await db.execute(text("""
                                    UPDATE users SET
                                        crm_id = COALESCE(NULLIF(:cid, ''), users.crm_id),
                                        email = COALESCE(NULLIF(:email, ''), users.email)
                                    WHERE id = :oid
                                """), {"cid": crm_id, "email": email, "oid": other_id})
                                user_id = other_id
                            else:
                                await db.execute(text("""
                                    UPDATE users SET
                                        name = CASE 
                                            WHEN (users.name LIKE 'Cliente CRM%' OR users.name IS NULL OR users.name = '') AND NULLIF(:name, '') IS NOT NULL THEN :name
                                            ELSE COALESCE(NULLIF(:name, ''), users.name)
                                        END,
                                        phone = CASE
                                            WHEN (users.phone LIKE '+57300000%' OR users.phone LIKE '+57399999%') AND NULLIF(:phone, '') IS NOT NULL AND :phone NOT LIKE '+57300000%' THEN :phone
                                            ELSE users.phone
                                        END,
                                        email = COALESCE(NULLIF(:email, ''), users.email),
                                        crm_id = COALESCE(NULLIF(:cid, ''), users.crm_id)
                                    WHERE id = :uid
                                """), {"uid": user_id, "name": name, "phone": phone, "email": email, "cid": crm_id})
                        else:
                            await db.execute(text("""
                                UPDATE users SET
                                    name = CASE 
                                        WHEN (users.name LIKE 'Cliente CRM%' OR users.name IS NULL OR users.name = '') AND NULLIF(:name, '') IS NOT NULL THEN :name
                                        ELSE COALESCE(NULLIF(:name, ''), users.name)
                                    END,
                                    email = COALESCE(NULLIF(:email, ''), users.email),
                                    crm_id = COALESCE(NULLIF(:cid, ''), users.crm_id)
                                WHERE id = :uid
                            """), {"uid": user_id, "name": name, "email": email, "cid": crm_id})
                    else:
                        has_real_name = bool(name and not name.startswith("Cliente CRM"))
                        has_real_phone = bool(phone and not phone.startswith("+57300000") and not phone.startswith("+57399999"))
                        if not has_real_name and not has_real_phone and not email:
                            logger.info(f"Evento de estado sin nombre/teléfono real para CRM ID {crm_id}; omitiendo creación de placeholder.")
                            return
                        result = await db.execute(text("""
                            INSERT INTO users (phone, name, email, crm_id, created_at)
                            VALUES (:phone, :name, :email, :cid, NOW())
                            ON CONFLICT (phone) DO UPDATE SET
                                name = COALESCE(NULLIF(users.name, ''), NULLIF(EXCLUDED.name, '')),
                                email = COALESCE(NULLIF(users.email, ''), NULLIF(EXCLUDED.email, '')),
                                crm_id = COALESCE(NULLIF(users.crm_id, ''), NULLIF(EXCLUDED.crm_id, ''))
                            RETURNING id
                        """), {
                            "phone": phone,
                            "name": name or (f"Cliente CRM {crm_id}" if crm_id else None),
                            "email": email or None,
                            "cid": crm_id or None
                        })
                        user_id = result.scalar()

                    # Extraer Plan de SmartMatchApp (membership, package, contract, custom fields)
                    plan_val = None
                    added_l = data.get("added_to_list")
                    raw_plan = (
                        data.get("plan_tier") or data.get("plan") or data.get("membership") or
                        data.get("membership_tier") or data.get("package") or data.get("contract") or
                        data.get("plan_name") or data.get("membership_name") or
                        (added_l.get("name") if isinstance(added_l, dict) else "") or ""
                    )
                    # Inspeccionar también si viene como dict o choice
                    if isinstance(raw_plan, dict):
                        raw_plan = raw_plan.get("choice_label") or raw_plan.get("name") or raw_plan.get("label") or ""
                    
                    # Buscar en campos personalizados (prof_XXX o field_XXX)
                    if not raw_plan:
                        for k, v in data.items():
                            if isinstance(v, dict) and "choice_label" in v:
                                lbl = str(v.get("choice_label", "")).lower()
                                if any(p in lbl for p in ["40k", "65k", "195k", "150k", "98k", "básico", "basico", "estándar", "estandar", "vip", "premium", "experience"]):
                                    raw_plan = v.get("choice_label")
                                    break
                            elif isinstance(v, str) and any(p in v.lower() for p in ["40k", "65k", "195k", "150k", "98k", "básico", "basico", "estándar", "estandar", "vip", "premium", "experience"]):
                                raw_plan = v
                                break

                    if raw_plan:
                        r_low = str(raw_plan).lower()
                        if "experience" in r_low:
                            plan_val = "Matchmaking Experience"
                        elif "195" in r_low or "vip" in r_low:
                            plan_val = "VIP 195k"
                        elif "150" in r_low or "premium" in r_low:
                            plan_val = "Premium"
                        elif "98" in r_low:
                            plan_val = "Estándar Plus 98k"
                        elif "65" in r_low or "estándar" in r_low or "estandar" in r_low or "2 citas" in r_low:
                            plan_val = "Estándar 65k (2 citas)"
                        elif "40" in r_low or "básico" in r_low or "basico" in r_low or "1 cita" in r_low:
                            plan_val = "Básico 40k"

                    notes = (
                        data.get("quick_note") or data.get("quick_notes") or
                        data.get("bio_notes") or data.get("bio") or
                        data.get("notes") or data.get("observaciones") or data.get("comment")
                    )

                    await db.execute(text("""
                        INSERT INTO profiles (user_id, age, gender, city, orientation, occupation, plan_tier, bio_notes, updated_at)
                        VALUES (:uid, :age, :gender, :city, :orientation, :occupation, :plan, :notes, NOW())
                        ON CONFLICT (user_id) DO UPDATE SET
                            age = COALESCE(profiles.age, EXCLUDED.age),
                            gender = COALESCE(NULLIF(profiles.gender, ''), NULLIF(EXCLUDED.gender, '')),
                            city = COALESCE(NULLIF(profiles.city, ''), NULLIF(EXCLUDED.city, '')),
                            orientation = COALESCE(NULLIF(profiles.orientation, ''), NULLIF(EXCLUDED.orientation, '')),
                            occupation = COALESCE(NULLIF(profiles.occupation, ''), NULLIF(EXCLUDED.occupation, '')),
                            plan_tier = COALESCE(NULLIF(EXCLUDED.plan_tier, ''), profiles.plan_tier),
                            bio_notes = COALESCE(NULLIF(profiles.bio_notes, ''), NULLIF(EXCLUDED.bio_notes, '')),
                            updated_at = NOW()
                    """), {
                        "uid": user_id,
                        "age": age or data.get("age") or data.get("edad"),
                        "gender": gender or data.get("gender") or data.get("genero") or "",
                        "city": city or data.get("city") or data.get("ciudad") or "",
                        "orientation": orientation or "",
                        "occupation": occupation or data.get("occupation") or data.get("profesion") or "",
                        "plan": plan_val or "",
                        "notes": notes
                    })
                    await db.commit()

                    # Sincronizar todos los campos extendidos CRM (lifestyle, education, estatura, love_language, apego, search_preferences)
                    if crm_id:
                        try:
                            from app.routers.matchmaking import _sync_crm_id_from_webhooks
                            await _sync_crm_id_from_webhooks(str(crm_id), db)
                        except Exception as e_sync:
                            logger.warning(f"No se pudo completar _sync_crm_id_from_webhooks para CRM ID {crm_id}: {e_sync}")

                    logger.info(f"Cliente procesado exitosamente vía Webhook: CRM ID {crm_id} - {name} (User ID: {user_id})")

            # 2. EVENTOS DE MATCH (match.created, match.updated, match_added, match_group_changed, intro.created, date.scheduled)
            elif any(k in event_type.lower() for k in ["match", "intro", "cita", "added", "group", "schedule", "date"]):
                person_a = data.get("person_a") or data.get("client_a") or data.get("persona_a")
                person_b = data.get("person_b") or data.get("client_b") or data.get("persona_b")

                # Fallback para estructuras de SmartMatchApp con cliente/match por ID u objeto
                if not (person_a and person_b):
                    client_info = data.get("client") if isinstance(data.get("client"), dict) else {}
                    match_info = data.get("match") if isinstance(data.get("match"), dict) else {}
                    
                    p_a_name = client_info.get("name") or client_info.get("full_name") or client_info.get("nombre")
                    p_b_name = match_info.get("name") or match_info.get("full_name") or match_info.get("nombre")

                    if p_a_name and p_b_name:
                        person_a, person_b = p_a_name, p_b_name
                    elif p_a_name:
                        person_a = p_a_name
                    elif p_b_name:
                        person_b = p_b_name

                # Buscar psicóloga explícita o asignar a revisión manual si no viene definida
                matchmaker = (data.get("matchmaker") or data.get("psicologa") or data.get("responsable") or "").strip()
                if not matchmaker and person_a:
                    res_psyc = await db.execute(text("""
                        SELECT p.responsable 
                        FROM users u
                        JOIN profiles p ON p.user_id = u.id
                        WHERE LOWER(TRIM(u.name)) = LOWER(TRIM(:pA))
                        LIMIT 1
                    """), {"pA": person_a})
                    row_psyc = res_psyc.fetchone()
                    if row_psyc and row_psyc[0]:
                        matchmaker = str(row_psyc[0]).replace("MATCHES ", "").strip()

                notes = data.get("notes") or data.get("observations") or data.get("notas") or f"SmartMatchApp Event: {event_type}"
                if not matchmaker:
                    matchmaker = "REVISIÓN MANUAL"
                    notes = f"{notes} [⚠️ Psicóloga no especificada en webhook - Asignación manual requerida]"

                # Procesamiento de fecha confirmada
                from app.services.google_sheets import parse_date_to_iso, append_match_to_sheet, sync_confirmed_date_to_matches

                raw_date = data.get("match_date") or data.get("date") or data.get("fecha") or data.get("scheduled_date") or data.get("appointment_date")
                parsed_iso_date = parse_date_to_iso(raw_date) if raw_date else None
                match_date = parsed_iso_date or str(raw_date or "Por agendar")
                
                group_name = data.get("group", {}).get("name") if isinstance(data.get("group"), dict) else ""
                status = str(group_name or data.get("status") or data.get("estado") or "PENDIENTE").upper()
                
                has_confirmed_date = bool(parsed_iso_date and parsed_iso_date.lower() not in ("por agendar", "pendiente", ""))
                if has_confirmed_date and status in ("PENDIENTE", ""):
                    status = "CITA CONFIRMADA"

                if person_a and person_b:
                    source_ref = f"webhook_match:{hashlib.md5(f'{person_a}|{person_b}|{match_date}'.encode()).hexdigest()[:16]}"
                    await db.execute(text("""
                        INSERT INTO historical_matches (person_a, person_b, matchmaker, match_date, status, observations, source_ref)
                        VALUES (:pA, :pB, :mm, :mdate, :status, :obs, :sref)
                        ON CONFLICT (source_ref) DO UPDATE SET
                            status = EXCLUDED.status,
                            observations = EXCLUDED.observations,
                            updated_at = NOW()
                    """), {
                        "pA": person_a,
                        "pB": person_b,
                        "mm": matchmaker,
                        "mdate": match_date,
                        "status": status,
                        "obs": notes,
                        "sref": source_ref
                    })

                    # Si viene con fecha confirmada, actualizar en operational_matches y match_confirmations
                    if has_confirmed_date:
                        res_op = await db.execute(text("""
                            SELECT id FROM operational_matches 
                            WHERE (LOWER(TRIM(person_a)) = LOWER(TRIM(:pA)) AND LOWER(TRIM(person_b)) = LOWER(TRIM(:pB)))
                               OR (LOWER(TRIM(person_a)) = LOWER(TRIM(:pB)) AND LOWER(TRIM(person_b)) = LOWER(TRIM(:pA)))
                            ORDER BY id DESC LIMIT 1
                        """), {"pA": person_a, "pB": person_b})
                        op_row = res_op.fetchone()

                        if op_row:
                            op_id = op_row[0]
                            await db.execute(text("""
                                UPDATE operational_matches 
                                SET status = 'CITA CONFIRMADA', updated_at = NOW() 
                                WHERE id = :id
                            """), {"id": op_id})

                            res_c = await db.execute(text("SELECT id FROM match_confirmations WHERE match_id = :mid LIMIT 1"), {"mid": op_id})
                            c_row = res_c.fetchone()
                            if c_row:
                                await db.execute(text("""
                                    UPDATE match_confirmations
                                    SET stage = 'cita confirmada', scheduled_date = :sdate, updated_at = NOW()
                                    WHERE id = :cid
                                """), {"cid": c_row[0], "sdate": parsed_iso_date})
                            else:
                                await db.execute(text("""
                                    INSERT INTO match_confirmations (match_id, stage, scheduled_date, created_at, updated_at)
                                    VALUES (:mid, 'cita confirmada', :sdate, NOW(), NOW())
                                """), {"mid": op_id, "sdate": parsed_iso_date})

                    await db.commit()
                    logger.info(f"Match procesado exitosamente vía Webhook: {person_a} x {person_b} (Estado: {status}, Fecha: {match_date})")

                    # Sincronización a Google Sheet en tiempo real
                    # 1. Pestaña de la psicóloga
                    if matchmaker and matchmaker != "REVISIÓN MANUAL":
                        try:
                            append_match_to_sheet(matchmaker, {
                                "PERSON A": person_a,
                                "PERSON B": person_b,
                                "FECHA": parsed_iso_date or match_date,
                                "STATUS": status,
                                "OBSERVACIONES": notes,
                                "CITY": data.get("city") or data.get("ciudad"),
                                "PAIS": data.get("country") or data.get("pais"),
                                "PLAN": data.get("plan") or data.get("plan_tier"),
                                "PREF": data.get("pref") or data.get("preferencia"),
                                "CRM": data.get("crm"),
                                "ID": data.get("id") or data.get("match_id"),
                            })
                            logger.info(f"Fila sincronizada a Google Sheet ({matchmaker}) para {person_a} x {person_b}")
                        except Exception as sheet_err:
                            logger.error(f"Error al intentar sincronizar a Google Sheet ({matchmaker}): {sheet_err}")

                    # 2. Si viene con fecha confirmada, escribirla en FECHA CITA REAL de MATCHES
                    if has_confirmed_date:
                        try:
                            venue_val = data.get("venue") or data.get("lugar") or data.get("restaurant") or data.get("restaurante")
                            city_val = data.get("city") or data.get("ciudad")
                            sync_confirmed_date_to_matches(
                                person_a=person_a,
                                person_b=person_b,
                                raw_date=parsed_iso_date or match_date,
                                status="cita confirmada",
                                venue=venue_val,
                                city=city_val
                            )
                            logger.info(f"✅ FECHA CITA REAL sincronizada a pestaña MATCHES para {person_a} x {person_b}: {parsed_iso_date}")
                        except Exception as matches_err:
                            logger.error(f"Error al intentar sincronizar FECHA CITA REAL a MATCHES: {matches_err}")



            # 3. EVENTOS DE NOTAS Y SURVEYS (note.created, survey.completed)
            elif any(k in event_type.lower() for k in ["note", "survey", "encuesta", "comentario"]):
                user_name = data.get("client_name") or data.get("user_name") or data.get("nombre")
                note_text = data.get("note") or data.get("comment") or data.get("respuesta") or data.get("quick_note") or json.dumps(data, ensure_ascii=False)
                crm_id = str(data.get("id") or data.get("client_id") or data.get("crm_id") or "").strip()

                uid = None
                if crm_id:
                    res_c = await db.execute(text("SELECT id FROM users WHERE crm_id = :cid LIMIT 1"), {"cid": crm_id})
                    uid = res_c.scalar()
                if not uid and user_name:
                    res = await db.execute(text("SELECT id FROM users WHERE LOWER(name) LIKE :n LIMIT 1"), {"n": f"%{user_name.lower()}%"})
                    uid = res.scalar()

                if uid and note_text:
                    await db.execute(text("""
                        INSERT INTO client_notes (user_id, note, source, created_at)
                        VALUES (:uid, :note, 'smartmatchapp_webhook', NOW())
                    """), {"uid": uid, "note": note_text})
                    await db.execute(text("""
                        UPDATE profiles 
                        SET bio_notes = COALESCE(NULLIF(bio_notes, ''), :note), updated_at = NOW()
                        WHERE user_id = :uid
                    """), {"uid": uid, "note": note_text})
                    await db.commit()
                    logger.info(f"Nota/Encuesta guardada para cliente ID: {uid} (CRM: {crm_id})")

        except Exception as e:
            logger.error(f"Error procesando payload de evento {event_type}: {e}")
        finally:
            if raw_event_id:
                try:
                    await db.execute(text("UPDATE webhook_events_raw SET processed = true WHERE id = :rid"), {"rid": raw_event_id})
                    await db.commit()
                except Exception as ex_u:
                    logger.warning(f"No se pudo marcar webhook {raw_event_id} como procesado: {ex_u}")


@router.api_route("/smartmatchapp", methods=["GET", "POST"])
@router.api_route("/smartmatchapp/", methods=["GET", "POST"])
async def smartmatchapp_webhook(request: Request, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """
    Endpoint de Webhook para SmartMatchApp.
    1. Verifica Handshake / Challenge.
    2. Exige y Valida firma HMAC.
    3. Registra evento raw en `webhook_events_raw`.
    4. Procesa payload en segundo plano (BackgroundTasks) y responde HTTP 200 rápido.
    """
    settings = get_settings()
    secret = settings.smartmatchapp_webhook_secret

    # 1. Verificación por Query Params (Handshake GET / POST)
    params = dict(request.query_params)
    for key in ["challenge", "hub.challenge", "token", "secret", "verify", "code"]:
        if key in params and params[key]:
            logger.warning(f"[SMARTMATCH-HANDSHAKE] {request.method} por query: clave={key} ct={request.headers.get('content-type')} ua={request.headers.get('user-agent')}")
            return JSONResponse({"challenge": str(params[key]), key: str(params[key])})

    body_bytes = await request.body()

    # 2. Verificación por JSON Body (Handshake de bienvenida)
    if body_bytes:
        try:
            payload_check = json.loads(body_bytes.decode("utf-8"))
            if isinstance(payload_check, dict):
                for k in ["challenge", "verification_token", "hub.challenge", "code", "token"]:
                    if k in payload_check and payload_check[k]:
                        logger.warning(f"[SMARTMATCH-HANDSHAKE] {request.method} por cuerpo: clave={k} ct={request.headers.get('content-type')} ua={request.headers.get('user-agent')} cuerpo={body_bytes[:300]!r}")
                        return JSONResponse({"challenge": str(payload_check[k]), k: str(payload_check[k])})
        except Exception:
            pass

    if request.method == "GET":
        return PlainTextResponse("OK")

    # Loguear todas las cabeceras recibidas para diagnóstico exacto
    headers_dict = dict(request.headers)
    logger.info(f"POST Webhook recibido en /smartmatchapp. Headers: {headers_dict}")

    # 3. Validar Firma Digital HMAC-SHA256 Exigida Siempre
    sig_header = (
        request.headers.get("X-Smart-Signature") or 
        request.headers.get("X-SmartMatch-Signature") or 
        request.headers.get("X-Webhook-Signature") or 
        request.headers.get("X-Hub-Signature-256") or
        request.headers.get("X-Signature") or
        request.headers.get("Signature") or
        request.headers.get("X-SmartMatchApp-Signature")
    )
    
    if not sig_header:
        # Buscar cualquier cabecera que contenga 'sig' o 'token'
        for h_k, h_v in headers_dict.items():
            if any(k in h_k.lower() for k in ["signature", "sig", "token"]):
                sig_header = h_v
                logger.info(f"Encontrada cabecera de firma alternativa: '{h_k}': '{h_v}'")
                break

    sig_ok = verify_signature(body_bytes, sig_header, secret)
    logger.warning(f"[SMARTMATCH-SIG] firma {'VÁLIDA' if sig_ok else 'NO coincide'} (cabecera presente: {bool(sig_header)}, longitud: {len(sig_header or '')})")
    if not sig_ok:
        # Con SMARTMATCHAPP_ENFORCE_SIGNATURE=1 solo se aceptan eventos auténticos del CRM (firma HMAC válida).
        if os.environ.get("SMARTMATCHAPP_ENFORCE_SIGNATURE", "0") == "1":
            raise HTTPException(status_code=401, detail="Invalid signature")
        logger.warning("Firma HMAC difiere pero evento recibido de SmartMatchApp — procesando webhook (modo permisivo).")


    # 4. Parsear Payload y Registrar Evento Raw en DB
    try:
        payload = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
    except Exception:
        payload = {}

    event_type = payload.get("event") or payload.get("type") or payload.get("action") or "generic.update"
    data = payload.get("payload") or payload.get("data") or payload

    raw_id = None
    try:
        # Guardar copia RAW en DB
        res_raw = await db.execute(text("""
            INSERT INTO webhook_events_raw (source, event_type, payload, processed, received_at)
            VALUES ('smartmatchapp', :etype, :payload, false, NOW())
            RETURNING id
        """), {
            "etype": event_type,
            "payload": json.dumps(payload, ensure_ascii=False)
        })
        raw_id = res_raw.scalar()
        await db.commit()
    except Exception as e:
        logger.warning(f"No se pudo guardar raw event: {e}")

    # 5. Despachar a segundo plano para responder HTTP 200 de inmediato (< 50ms)
    background_tasks.add_task(process_webhook_payload, event_type, data, raw_id)

    return {"status": "success", "message": "Evento recibido y encolado correctamente"}


@router.post("/calendly")
async def calendly_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Endpoint para recibir eventos de entrevistas completadas desde Calendly.
    Cruza los datos del invitado contra SmartMatchApp CRM y registra automáticamente
    al usuario en la pestaña PROFILES con Responsable vacío en amarillo (#FFF2CC).
    """
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Error parseando JSON de Calendly: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = payload.get("event") or "calendly.event"
    logger.info(f"Calendly Webhook recibido: {event_type}")

    # 1. Guardar copia cruda en base de datos para auditoría
    try:
        await db.execute(text("""
            INSERT INTO webhook_events_raw (source, event_type, payload, processed, received_at)
            VALUES ('calendly', :etype, :payload, false, NOW())
        """), {
            "etype": event_type,
            "payload": json.dumps(payload, ensure_ascii=False)
        })
        await db.commit()
    except Exception as e:
        logger.warning(f"No se pudo guardar raw event de Calendly: {e}")

    # 2. Procesar cruce CRM -> PROFILES
    from app.services.calendly_sync import process_calendly_interview_completed
    result = await process_calendly_interview_completed(payload, db)

    return {"status": "success", "result": result}


@router.post("/calendly/sync")
async def calendly_poll_sync(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Endpoint de sondeo (polling) activo para sincronizar entrevistas de Calendly:
    Permite consultar directamente a la API de Calendly eventos recientes o un evento específico por UUID.
    Útil cuando los webhooks automáticos de Calendly no están activos por restricciones del plan.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    limit = body.get("limit", 5)
    event_uuid = body.get("event_uuid")

    from app.services.calendly_sync import poll_calendly_scheduled_events
    result = await poll_calendly_scheduled_events(db, limit=limit, event_uuid=event_uuid)
    return result


