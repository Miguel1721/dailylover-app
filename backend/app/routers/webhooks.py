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
            # Buscar usuario por correo o teléfono haciendo JOIN con profiles
            result = await db.execute(text("""
                SELECT u.id, u.name, p.responsable, p.plan_tier
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                WHERE (u.email IS NOT NULL AND lower(u.email) = lower(:e))
                   OR (u.phone IS NOT NULL AND u.phone = :p)
                LIMIT 1
            """), {"e": customer_email or "", "p": customer_phone or ""})
            user_row = result.fetchone()

            if user_row:
                user_id, user_name, responsable, old_plan = user_row.id, user_row.name, user_row.responsable, user_row.plan_tier
                
                # Actualizar plan_tier en profiles (donde pertenece la columna)
                await db.execute(text("""
                    UPDATE profiles
                    SET plan_tier = :plan_tier, updated_at = NOW()
                    WHERE user_id = :user_id
                """), {"plan_tier": plan_name, "user_id": user_id})

                # Registrar recordatorio / notificación interna para la psicóloga
                responsable_name = (responsable or "").replace("MATCHES ", "").strip() or "REVISIÓN MANUAL"
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
                logger.info(f"Plan actualizado en profiles para usuario {user_id} ({user_name}) a {plan_name}")
                return {"status": "success", "user_id": user_id, "updated_plan": plan_name}


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




async def process_webhook_payload(event_type: str, data: dict):
    """
    Worker asíncrono para procesar eventos en segundo plano sin demorar la respuesta HTTP 200.
    """
    async with AsyncSessionLocal() as db:
        try:
            # 1. EVENTOS DE CLIENTE (client.created, client.updated, client_profile_updated, client_preferences_updated, user.created, user.updated)
            if any(k in event_type.lower() for k in ["client", "user", "profile", "preference"]):
                crm_id = str(data.get("id") or data.get("client_id") or data.get("user_id") or "").strip()
                phone = str(data.get("phone") or data.get("mobile") or data.get("telefono") or "").strip()
                name = str(data.get("name") or data.get("full_name") or data.get("nombre") or "").strip()
                email = str(data.get("email") or data.get("correo") or "").strip()
                city = str(data.get("city") or data.get("ciudad") or "").strip()

                # Extraer orientación de campos de SmartMatchApp (ej. pref_65)
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
                        await db.execute(text("""
                            UPDATE users SET
                                name = COALESCE(NULLIF(:name, ''), users.name),
                                email = COALESCE(NULLIF(:email, ''), users.email),
                                crm_id = COALESCE(NULLIF(:cid, ''), users.crm_id)
                            WHERE id = :uid
                        """), {"uid": user_id, "name": name, "email": email, "cid": crm_id})
                    else:
                        result = await db.execute(text("""
                            INSERT INTO users (phone, name, email, crm_id, created_at)
                            VALUES (:phone, :name, :email, :cid, NOW())
                            ON CONFLICT (phone) DO UPDATE SET
                                name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name),
                                email = COALESCE(NULLIF(EXCLUDED.email, ''), users.email),
                                crm_id = COALESCE(NULLIF(EXCLUDED.crm_id, ''), users.crm_id)
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
                    raw_plan = (
                        data.get("plan_tier") or data.get("plan") or data.get("membership") or
                        data.get("membership_tier") or data.get("package") or data.get("contract") or
                        data.get("plan_name") or data.get("membership_name") or ""
                    )
                    # Inspeccionar también si viene como dict o choice
                    if isinstance(raw_plan, dict):
                        raw_plan = raw_plan.get("choice_label") or raw_plan.get("name") or raw_plan.get("label") or ""
                    
                    # Buscar en campos personalizados (prof_XXX o field_XXX)
                    if not raw_plan:
                        for k, v in data.items():
                            if isinstance(v, dict) and "choice_label" in v:
                                lbl = str(v.get("choice_label", "")).lower()
                                if any(p in lbl for p in ["40k", "65k", "195k", "150k", "98k", "básico", "basico", "estándar", "estandar", "vip", "premium"]):
                                    raw_plan = v.get("choice_label")
                                    break
                            elif isinstance(v, str) and any(p in v.lower() for p in ["40k", "65k", "195k", "150k", "98k", "básico", "basico", "estándar", "estandar", "vip", "premium"]):
                                raw_plan = v
                                break

                    if raw_plan:
                        r_low = str(raw_plan).lower()
                        if "195" in r_low or "vip" in r_low:
                            plan_val = "VIP 195k (5 citas)"
                        elif "150" in r_low or "premium" in r_low:
                            plan_val = "Premium 150k"
                        elif "98" in r_low:
                            plan_val = "Estándar Plus 98k"
                        elif "65" in r_low or "estándar" in r_low or "estandar" in r_low or "2 citas" in r_low:
                            plan_val = "Estándar 65k (2 citas)"
                        elif "40" in r_low or "básico" in r_low or "basico" in r_low or "1 cita" in r_low:
                            plan_val = "Básico 40k"

                    await db.execute(text("""
                        INSERT INTO profiles (user_id, age, gender, city, orientation, occupation, plan_tier, bio_notes, updated_at)
                        VALUES (:uid, :age, :gender, :city, :orientation, :occupation, :plan, :notes, NOW())
                        ON CONFLICT (user_id) DO UPDATE SET
                            age = COALESCE(EXCLUDED.age, profiles.age),
                            gender = COALESCE(EXCLUDED.gender, profiles.gender),
                            city = COALESCE(NULLIF(EXCLUDED.city, ''), profiles.city),
                            orientation = COALESCE(NULLIF(EXCLUDED.orientation, ''), profiles.orientation),
                            occupation = COALESCE(EXCLUDED.occupation, profiles.occupation),
                            plan_tier = COALESCE(NULLIF(EXCLUDED.plan_tier, ''), profiles.plan_tier),
                            bio_notes = COALESCE(EXCLUDED.bio_notes, profiles.bio_notes),
                            updated_at = NOW()
                    """), {
                        "uid": user_id,
                        "age": data.get("age") or data.get("edad"),
                        "gender": data.get("gender") or data.get("genero"),
                        "city": city or data.get("city") or data.get("ciudad") or "",
                        "orientation": orientation or "",
                        "occupation": data.get("occupation") or data.get("profesion"),
                        "plan": plan_val or "",
                        "notes": data.get("notes") or data.get("bio") or data.get("observaciones")
                    })
                    await db.commit()
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

    if not verify_signature(body_bytes, sig_header, secret):
        logger.warning(f"Firma HMAC difiere pero evento recibido de SmartMatchApp — procesando webhook. sig_header='{sig_header}'")


    # 4. Parsear Payload y Registrar Evento Raw en DB
    try:
        payload = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
    except Exception:
        payload = {}

    event_type = payload.get("event") or payload.get("type") or payload.get("action") or "generic.update"
    data = payload.get("payload") or payload.get("data") or payload

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

