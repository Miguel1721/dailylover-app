from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.database import get_db
from app.schemas.cms import (
    CityResponse,
    EventResponse,
    FormFieldResponse,
    BlindDateSubmit,
)
from app.services.encryption_service import encrypt_text, encrypt_json

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1/public", tags=["CMS Public"])


@router.get("/cities", response_model=List[CityResponse])
async def get_public_cities(db: AsyncSession = Depends(get_db)):
    """Retorna las ciudades activas para la app pública."""
    result = await db.execute(text("""
        SELECT id, name, tagline, hero_badge, hero_title, hero_subtitle, hero_image_url,
               cta_text, cta_url, currency, whatsapp_number, whatsapp_message, is_active, sort_order,
               created_at, updated_at
        FROM cities
        WHERE is_active = true
        ORDER BY sort_order ASC, name ASC;
    """))
    rows = result.fetchall()
    cities = []
    for r in rows:
        cities.append({
            "id": r.id,
            "name": r.name,
            "tagline": r.tagline,
            "hero_badge": r.hero_badge,
            "hero_title": r.hero_title,
            "hero_subtitle": r.hero_subtitle,
            "hero_image_url": r.hero_image_url,
            "cta_text": r.cta_text,
            "cta_url": r.cta_url,
            "currency": r.currency,
            "whatsapp_number": r.whatsapp_number,
            "whatsapp_message": r.whatsapp_message,
            "is_active": r.is_active,
            "sort_order": r.sort_order,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        })
    return cities


@router.get("/events", response_model=List[EventResponse])
async def get_public_events(city: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Retorna los eventos publicados, opcionalmente filtrados por ciudad."""
    if city and city != "all":
        result = await db.execute(text("""
            SELECT id, title, subtitle, description, image_url, event_date, event_time, venue,
                   cta_label, cta_url, provider, status, sort_order, city_id, created_at, updated_at
            FROM events
            WHERE status = 'published' AND (city_id = :city OR city_id IS NULL)
            ORDER BY sort_order ASC, created_at DESC;
        """), {"city": city})
    else:
        result = await db.execute(text("""
            SELECT id, title, subtitle, description, image_url, event_date, event_time, venue,
                   cta_label, cta_url, provider, status, sort_order, city_id, created_at, updated_at
            FROM events
            WHERE status = 'published'
            ORDER BY sort_order ASC, created_at DESC;
        """))
    rows = result.fetchall()
    events = []
    for r in rows:
        events.append({
            "id": r.id,
            "title": r.title,
            "subtitle": r.subtitle,
            "description": r.description,
            "image_url": r.image_url,
            "event_date": r.event_date,
            "event_time": r.event_time,
            "venue": r.venue,
            "cta_label": r.cta_label or "Ver Más",
            "cta_url": r.cta_url or "#",
            "provider": r.provider or "other",
            "status": r.status,
            "sort_order": r.sort_order or 0,
            "city_id": r.city_id,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        })
    return events


@router.get("/blind-date-fields", response_model=List[FormFieldResponse])
async def get_public_form_fields(db: AsyncSession = Depends(get_db)):
    """Retorna los campos del formulario de Blind Date activos."""
    result = await db.execute(text("""
        SELECT id, field_key, label, field_type, options, is_required, sort_order, is_active, created_at
        FROM blind_date_form_fields
        WHERE is_active = true
        ORDER BY sort_order ASC;
    """))
    rows = result.fetchall()
    fields = []
    for r in rows:
        opts = r.options if isinstance(r.options, list) else []
        fields.append({
            "id": r.id,
            "field_key": r.field_key,
            "label": r.label,
            "field_type": r.field_type,
            "options": opts,
            "is_required": r.is_required,
            "sort_order": r.sort_order,
            "is_active": r.is_active,
            "created_at": r.created_at,
        })
    return fields


@router.post("/blind-date-responses", status_code=status.HTTP_201_CREATED)
async def submit_blind_date_response(
    payload: BlindDateSubmit,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Envío público del formulario de Blind Date.
    - Requiere consentimiento explícito de Términos (accept_terms = true).
    - Cifra PII (email, phone, answers) a nivel de aplicación con Fernet.
    - Determina la jurisdicción legal (co, mx, es, us_fl).
    """
    if not payload.accept_terms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe aceptar expresamente los Términos y la Política de Tratamiento de Datos."
        )

    # Map city to jurisdiction
    city_jur_map = {
        "colombia": "co",
        "miami": "us_fl",
        "madrid": "es",
        "cdmx": "mx"
    }
    jurisdiction = city_jur_map.get(payload.city_id or "colombia", "co")

    # Client IP for abuse prevention
    client_ip = request.client.host if request.client else None

    # Application-level encryption of sensitive fields
    encrypted_email = encrypt_text(payload.contact_email)
    encrypted_phone = encrypt_text(payload.contact_phone)
    encrypted_answers = encrypt_json(payload.answers)

    now = datetime.now(timezone.utc)

    result = await db.execute(text("""
        INSERT INTO blind_date_responses (
            city_id, contact_email, contact_phone, answers, photo_urls,
            consent_accepted_at, status, ip_address, jurisdiction, retention_days
        ) VALUES (
            :city_id, :contact_email, :contact_phone, :answers, :photo_urls,
            :consent_accepted_at, 'new', :ip_address, :jurisdiction, 365
        ) RETURNING id, submitted_at;
    """), {
        "city_id": payload.city_id,
        "contact_email": encrypted_email,
        "contact_phone": encrypted_phone,
        "answers": encrypted_answers,
        "photo_urls": payload.photo_urls or [],
        "consent_accepted_at": now,
        "ip_address": client_ip,
        "jurisdiction": jurisdiction
    })
    row = result.fetchone()
    await db.commit()

    logger.info("Blind Date response submitted safely", response_id=str(row.id), jurisdiction=jurisdiction)

    return {
        "status": "success",
        "message": "Tu solicitud de Blind Date ha sido recibida exitosamente.",
        "response_id": str(row.id),
        "submitted_at": row.submitted_at
    }
