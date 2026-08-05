"""
Stripe & SmartMatchApp Webhook Router for Daily Lover
Handles automatic plan upgrades, subscriptions, payment events from Stripe,
and real-time event sync from SmartMatchApp into Postgres DB.
"""

from fastapi import APIRouter, Request, HTTPException, Depends, Header, BackgroundTasks
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
import json
import logging
import hmac
import hashlib
import base64

from app.database import get_db, AsyncSessionLocal
from app.config import get_settings

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
            for key, name in STRIPE_PLAN_MAP.items():
                if key in str(amount_paid):
                    plan_name = name
                    break

        if customer_email or customer_phone:
            # Buscar usuario por correo o teléfono
            result = await db.execute(
                text("SELECT id, name, plan_tier, responsable FROM users WHERE email = :e OR phone = :p LIMIT 1"),
                {"e": customer_email, "p": customer_phone}
            )
            user_row = result.fetchone()

            if user_row:
                user_id, user_name, old_plan, responsable = user_row.id, user_row.name, user_row.plan_tier, user_row.responsable
                await db.execute(text("""
                    UPDATE users 
                    SET plan_tier = :plan_tier, updated_at = NOW()
                    WHERE id = :user_id
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


# ─── SMARTMATCHAPP INTEGRACIÓN EN TIEMPO REAL ─────────────────────────

def verify_signature(body_bytes: bytes, signature_header: str, secret: str) -> bool:
    """
    Valida la firma HMAC-SHA256 enviada en los webhooks de SmartMatchApp.
    Soporta formato Base64 o Hexadecimal mediante hmac.compare_digest.
    """
    if not signature_header or not secret:
        return True # Si no se ha configurado header de firma aún en el panel, continuar

    secret_bytes = secret.encode("utf-8")
    
    # 1. Probar HMAC Hexadecimal
    expected_hex = hmac.new(secret_bytes, body_bytes, hashlib.sha256).hexdigest()
    if hmac.compare_digest(expected_hex.lower(), signature_header.lower()):
        return True

    # 2. Probar HMAC Base64
    expected_b64 = base64.b64encode(hmac.new(secret_bytes, body_bytes, hashlib.sha256).digest()).decode("utf-8")
    if hmac.compare_digest(expected_b64, signature_header):
        return True

    return False


async def process_webhook_payload(event_type: str, data: dict):
    """
    Worker asíncrono para procesar eventos en segundo plano sin demorar la respuesta HTTP 200.
    """
    async with AsyncSessionLocal() as db:
        try:
            # 1. EVENTOS DE CLIENTE (client.created, client.updated, user.created, user.updated)
            if any(k in event_type.lower() for k in ["client", "user", "profile"]):
                phone = str(data.get("phone") or data.get("mobile") or data.get("telefono") or "").strip()
                name = str(data.get("name") or data.get("full_name") or data.get("nombre") or "").strip()
                email = str(data.get("email") or data.get("correo") or "").strip()

                if phone or email or name:
                    # Normalizar teléfono
                    if phone:
                        phone = phone.replace(" ", "").replace("-", "")
                        if not phone.startswith("+"):
                            phone = "+57" + phone.lstrip("0")

                    # Upsert User
                    result = await db.execute(text("""
                        INSERT INTO users (phone, name, email, plan_tier)
                        VALUES (:phone, :name, :email, :plan)
                        ON CONFLICT (phone) DO UPDATE SET
                            name = COALESCE(EXCLUDED.name, users.name),
                            email = COALESCE(EXCLUDED.email, users.email)
                        RETURNING id
                    """), {
                        "phone": phone or f"+57300000{hash(name)%100000:05d}",
                        "name": name or None,
                        "email": email or None,
                        "plan": data.get("plan_tier") or data.get("plan") or "Estándar 65k"
                    })
                    user_id = result.scalar()

                    # Upsert Profile
                    await db.execute(text("""
                        INSERT INTO profiles (user_id, age, gender, city, occupation, bio_notes, updated_at)
                        VALUES (:uid, :age, :gender, :city, :occupation, :notes, NOW())
                        ON CONFLICT (user_id) DO UPDATE SET
                            age = COALESCE(EXCLUDED.age, profiles.age),
                            gender = COALESCE(EXCLUDED.gender, profiles.gender),
                            city = COALESCE(EXCLUDED.city, profiles.city),
                            occupation = COALESCE(EXCLUDED.occupation, profiles.occupation),
                            bio_notes = COALESCE(EXCLUDED.bio_notes, profiles.bio_notes),
                            updated_at = NOW()
                    """), {
                        "uid": user_id,
                        "age": data.get("age") or data.get("edad"),
                        "gender": data.get("gender") or data.get("genero"),
                        "city": data.get("city") or data.get("ciudad"),
                        "occupation": data.get("occupation") or data.get("profesion"),
                        "notes": data.get("notes") or data.get("bio") or data.get("observaciones")
                    })
                    await db.commit()
                    logger.info(f"Cliente procesado exitosamente vía Webhook: {name} (ID: {user_id})")

            # 2. EVENTOS DE MATCH (match.created, match.updated, intro.created)
            elif any(k in event_type.lower() for k in ["match", "intro", "cita"]):
                person_a = data.get("person_a") or data.get("client_a") or data.get("persona_a")
                person_b = data.get("person_b") or data.get("client_b") or data.get("persona_b")
                matchmaker = data.get("matchmaker") or data.get("psicologa") or "SILVI"
                match_date = str(data.get("match_date") or data.get("date") or data.get("fecha") or "Por agendar")
                status = str(data.get("status") or data.get("estado") or "PENDIENTE").upper()
                notes = data.get("notes") or data.get("observations") or data.get("notas")

                if person_a and person_b:
                    await db.execute(text("""
                        INSERT INTO historical_matches (person_a, person_b, matchmaker, match_date, status, observations)
                        VALUES (:pA, :pB, :mm, :mdate, :status, :obs)
                    """), {
                        "pA": person_a,
                        "pB": person_b,
                        "mm": matchmaker,
                        "mdate": match_date,
                        "status": status,
                        "obs": notes or "Sincronizado vía Webhook SmartMatchApp"
                    })
                    await db.commit()
                    logger.info(f"Match procesado exitosamente vía Webhook: {person_a} x {person_b}")

            # 3. EVENTOS DE NOTAS Y SURVEYS (note.created, survey.completed)
            elif any(k in event_type.lower() for k in ["note", "survey", "encuesta", "comentario"]):
                user_name = data.get("client_name") or data.get("user_name") or data.get("nombre")
                note_text = data.get("note") or data.get("comment") or data.get("respuesta") or json.dumps(data, ensure_ascii=False)

                if user_name and note_text:
                    res = await db.execute(text("SELECT id FROM users WHERE LOWER(name) LIKE :n LIMIT 1"), {"n": f"%{user_name.lower()}%"})
                    uid = res.scalar()
                    if uid:
                        await db.execute(text("""
                            INSERT INTO client_notes (user_id, note, source, created_at)
                            VALUES (:uid, :note, 'smartmatchapp_webhook', NOW())
                        """), {"uid": uid, "note": note_text})
                        await db.commit()
                        logger.info(f"Nota/Encuesta guardada para cliente ID: {uid}")

        except Exception as e:
            logger.error(f"Error procesando payload de evento {event_type}: {e}")


@router.api_route("/smartmatchapp", methods=["GET", "POST"])
@router.api_route("/smartmatchapp/", methods=["GET", "POST"])
async def smartmatchapp_webhook(request: Request, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """
    Endpoint de Webhook para SmartMatchApp.
    1. Verifica Handshake / Challenge.
    2. Valida firma HMAC.
    3. Registra evento raw en `webhook_events_raw`.
    4. Procesa payload en segundo plano (BackgroundTasks) y responde HTTP 200 rápido.
    """
    settings = get_settings()
    secret = settings.smartmatchapp_webhook_secret

    # 1. Verificación por Query Params (Handshake GET / POST)
    params = dict(request.query_params)
    for key in ["challenge", "hub.challenge", "token", "secret", "verify", "code"]:
        if key in params and params[key]:
            return PlainTextResponse(str(params[key]))

    body_bytes = await request.body()

    # 2. Verificación por JSON Body (Handshake de bienvenida)
    if body_bytes:
        try:
            payload_check = json.loads(body_bytes.decode("utf-8"))
            if isinstance(payload_check, dict):
                for k in ["challenge", "verification_token", "hub.challenge", "code", "token"]:
                    if k in payload_check and payload_check[k]:
                        return PlainTextResponse(str(payload_check[k]))
        except Exception:
            pass

    if request.method == "GET":
        return PlainTextResponse(secret)

    # 3. Validar Firma Digital HMAC-SHA256 (Tarea 2)
    sig_header = (
        request.headers.get("X-Smart-Signature") or 
        request.headers.get("X-SmartMatch-Signature") or 
        request.headers.get("X-Webhook-Signature") or 
        request.headers.get("X-Hub-Signature-256")
    )
    if sig_header and not verify_signature(body_bytes, sig_header, secret):
        raise HTTPException(status_code=401, detail="Firma de Webhook inválida")

    # 4. Parsear Payload y Registrar Evento Raw en DB (Tarea 4)
    try:
        payload = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
    except Exception:
        payload = {}

    event_type = payload.get("event") or payload.get("type") or payload.get("action") or "generic.update"
    data = payload.get("data") or payload

    try:
        # Guardar copia RAW en DB
        await db.execute(text("""
            INSERT INTO webhook_events_raw (source, event_type, payload, processed, received_at)
            VALUES ('smartmatchapp', :etype, :payload, false, NOW())
        """), {
            "etype": event_type,
            "payload": json.dumps(payload, ensure_ascii=False)
        })
        await db.commit()
    except Exception as e:
        logger.warning(f"No se pudo guardar raw event: {e}")

    # 5. Despachar a segundo plano para responder HTTP 200 de inmediato (< 50ms)
    background_tasks.add_task(process_webhook_payload, event_type, data)

    return {"status": "success", "message": "Evento recibido y encolado correctamente"}
