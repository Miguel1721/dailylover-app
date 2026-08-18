import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image
import structlog

from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.cms import (
    CityResponse, CityCreate, CityUpdate,
    EventResponse, EventCreate, EventUpdate,
    FormFieldResponse, FormFieldCreate, FormFieldUpdate,
    BlindDateResponseDetail
)
from app.services.encryption_service import decrypt_text, decrypt_json

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1/admin", tags=["CMS Admin"])

# Static upload path
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─── 1. MEDIA UPLOAD ENDPOINT ──────────────────────────────────────────────────

@router.post("/media/upload")
async def upload_cms_media(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Subida segura de imágenes para el CMS.
    - Valida extensión (.jpg, .jpeg, .png, .webp)
    - Valida tamaño máximo (10 MB)
    - Verifica cabecera mágica del archivo con PIL Image inspection
    - Guarda en el volumen persistente /app/static/uploads
    """
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Formato no soportado. Solo se permiten imágenes JPG, PNG o WEBP.")

    # Read bytes and check size
    file_bytes = await file.read()
    max_size = 10 * 1024 * 1024  # 10 MB
    if len(file_bytes) > max_size:
        raise HTTPException(status_code=400, detail="El archivo excede el tamaño máximo permitido de 10 MB.")

    # PIL verification (magic bytes check)
    try:
        from io import BytesIO
        img = Image.open(BytesIO(file_bytes))
        img.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="El archivo subido no es una imagen válida o está corrompido.")

    # Generate unique filename
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    target_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(target_path, "wb") as f:
        f.write(file_bytes)

    public_url = f"/static/uploads/{unique_filename}"
    logger.info("CMS media uploaded successfully", filename=unique_filename, user=current_user.get("email"))

    return {
        "status": "success",
        "url": public_url,
        "filename": unique_filename,
        "size_bytes": len(file_bytes)
    }


# ─── 2. CITIES ENDPOINTS ───────────────────────────────────────────────────────

@router.get("/cities", response_model=List[CityResponse])
async def list_admin_cities(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(text("""
        SELECT id, name, tagline, hero_badge, hero_title, hero_subtitle, hero_image_url,
               cta_text, cta_url, currency, whatsapp_number, whatsapp_message, is_active, sort_order,
               created_at, updated_at
        FROM cities
        ORDER BY sort_order ASC;
    """))
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/cities", response_model=CityResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_city(
    payload: CityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(text("""
        INSERT INTO cities (
            id, name, tagline, hero_badge, hero_title, hero_subtitle, hero_image_url,
            cta_text, cta_url, currency, whatsapp_number, whatsapp_message, is_active, sort_order
        ) VALUES (
            :id, :name, :tagline, :hero_badge, :hero_title, :hero_subtitle, :hero_image_url,
            :cta_text, :cta_url, :currency, :whatsapp_number, :whatsapp_message, :is_active, :sort_order
        ) RETURNING id, name, tagline, hero_badge, hero_title, hero_subtitle, hero_image_url,
                    cta_text, cta_url, currency, whatsapp_number, whatsapp_message, is_active, sort_order, created_at, updated_at;
    """), payload.model_dump())
    row = result.fetchone()
    await db.commit()
    return dict(row._mapping)


@router.patch("/cities/{city_id}", response_model=CityResponse)
async def update_admin_city(
    city_id: str,
    payload: CityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    set_clauses = [f"{k} = :{k}" for k in update_data.keys()]
    set_clauses.append("updated_at = now()")
    sql = f"UPDATE cities SET {', '.join(set_clauses)} WHERE id = :city_id RETURNING id, name, tagline, hero_badge, hero_title, hero_subtitle, hero_image_url, cta_text, cta_url, currency, whatsapp_number, whatsapp_message, is_active, sort_order, created_at, updated_at;"

    update_data["city_id"] = city_id
    result = await db.execute(text(sql), update_data)
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ciudad no encontrada")
    await db.commit()
    return dict(row._mapping)


@router.delete("/cities/{city_id}")
async def delete_admin_city(
    city_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(text("DELETE FROM cities WHERE id = :city_id RETURNING id;"), {"city_id": city_id})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ciudad no encontrada")
    await db.commit()
    return {"status": "success", "message": f"Ciudad {city_id} eliminada."}


# ─── 3. EVENTS ENDPOINTS ───────────────────────────────────────────────────────

@router.get("/events", response_model=List[EventResponse])
async def list_admin_events(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(text("""
        SELECT id, title, subtitle, description, image_url, event_date, event_time, venue,
               cta_label, cta_url, provider, status, sort_order, city_id, created_at, updated_at
        FROM events
        ORDER BY sort_order ASC, created_at DESC;
    """))
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_event(
    payload: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    data = payload.model_dump()
    data["name"] = data["title"]
    if data.get("event_date"):
        data["date"] = datetime.combine(data["event_date"], datetime.min.time())
    else:
        data["date"] = datetime.now()
    result = await db.execute(text("""
        INSERT INTO events (
            title, name, date, subtitle, description, image_url, event_date, event_time, venue,
            cta_label, cta_url, provider, status, sort_order, city_id
        ) VALUES (
            :title, :name, :date, :subtitle, :description, :image_url, :event_date, :event_time, :venue,
            :cta_label, :cta_url, :provider, :status, :sort_order, :city_id
        ) RETURNING id, title, subtitle, description, image_url, event_date, event_time, venue,
                    cta_label, cta_url, provider, status, sort_order, city_id, created_at, updated_at;
    """), data)
    row = result.fetchone()
    await db.commit()
    return dict(row._mapping)


@router.patch("/events/{event_id}", response_model=EventResponse)
async def update_admin_event(
    event_id: str,
    payload: EventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    if "title" in update_data:
        update_data["name"] = update_data["title"]

    set_clauses = [f"{k} = :{k}" for k in update_data.keys()]
    set_clauses.append("updated_at = now()")

    # Handle UUID or Int id safely
    sql = f"UPDATE events SET {', '.join(set_clauses)} WHERE id::text = :event_id RETURNING id, title, subtitle, description, image_url, event_date, event_time, venue, cta_label, cta_url, provider, status, sort_order, city_id, created_at, updated_at;"

    update_data["event_id"] = str(event_id)
    result = await db.execute(text(sql), update_data)
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    await db.commit()
    return dict(row._mapping)


@router.delete("/events/{event_id}")
async def delete_admin_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(text("DELETE FROM events WHERE id::text = :event_id RETURNING id;"), {"event_id": str(event_id)})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    await db.commit()
    return {"status": "success", "message": f"Evento {event_id} eliminado."}


# ─── 4. BLIND DATE FORM FIELDS ENDPOINTS ───────────────────────────────────────

@router.get("/blind-date-fields", response_model=List[FormFieldResponse])
async def list_admin_form_fields(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(text("""
        SELECT id, field_key, label, field_type, options, is_required, sort_order, is_active, created_at
        FROM blind_date_form_fields
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


@router.post("/blind-date-fields", response_model=FormFieldResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_form_field(
    payload: FormFieldCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    import json
    opts_json = json.dumps(payload.options) if payload.options else None
    result = await db.execute(text("""
        INSERT INTO blind_date_form_fields (
            field_key, label, field_type, options, is_required, sort_order, is_active
        ) VALUES (
            :field_key, :label, :field_type, CAST(:opts_json AS jsonb), :is_required, :sort_order, :is_active
        ) RETURNING id, field_key, label, field_type, options, is_required, sort_order, is_active, created_at;
    """), {
        "field_key": payload.field_key,
        "label": payload.label,
        "field_type": payload.field_type,
        "opts_json": opts_json,
        "is_required": payload.is_required,
        "sort_order": payload.sort_order,
        "is_active": payload.is_active
    })
    row = result.fetchone()
    await db.commit()
    opts = row.options if isinstance(row.options, list) else []
    return {
        "id": row.id,
        "field_key": row.field_key,
        "label": row.label,
        "field_type": row.field_type,
        "options": opts,
        "is_required": row.is_required,
        "sort_order": row.sort_order,
        "is_active": row.is_active,
        "created_at": row.created_at
    }


@router.patch("/blind-date-fields/{field_id}", response_model=FormFieldResponse)
async def update_admin_form_field(
    field_id: str,
    payload: FormFieldUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    import json
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    if "options" in update_data:
        update_data["options"] = json.dumps(update_data["options"])
        sql = "UPDATE blind_date_form_fields SET options = CAST(:options AS jsonb)"
        other_keys = [k for k in update_data.keys() if k != "options"]
        if other_keys:
            sql += ", " + ", ".join([f"{k} = :{k}" for k in other_keys])
    else:
        sql = f"UPDATE blind_date_form_fields SET {', '.join([f'{k} = :{k}' for k in update_data.keys()])}"

    sql += " WHERE id::text = :field_id RETURNING id, field_key, label, field_type, options, is_required, sort_order, is_active, created_at;"
    update_data["field_id"] = str(field_id)

    result = await db.execute(text(sql), update_data)
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Campo no encontrado")
    await db.commit()
    opts = row.options if isinstance(row.options, list) else []
    return {
        "id": row.id,
        "field_key": row.field_key,
        "label": row.label,
        "field_type": row.field_type,
        "options": opts,
        "is_required": row.is_required,
        "sort_order": row.sort_order,
        "is_active": row.is_active,
        "created_at": row.created_at
    }


@router.delete("/blind-date-fields/{field_id}")
async def delete_admin_form_field(
    field_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(text("DELETE FROM blind_date_form_fields WHERE id::text = :field_id RETURNING id;"), {"field_id": str(field_id)})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Campo no encontrado")
    await db.commit()
    return {"status": "success", "message": f"Campo {field_id} eliminado."}


# ─── 5. BLIND DATE RESPONSES (WITH AUDIT LOGGING) ──────────────────────────────

@router.get("/blind-date-responses", response_model=List[BlindDateResponseDetail])
async def list_admin_responses(
    city: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Listar respuestas de Blind Date con descifrado y Registro en Audit Log.
    """
    user_email = current_user.get("email", "admin@dailylover.com")

    # Record Audit Log for bulk access
    await db.execute(text("""
        INSERT INTO blind_date_audit_logs (user_email, action, details)
        VALUES (:email, 'LIST_RESPONSES', CAST(:details AS jsonb));
    """), {
        "email": user_email,
        "details": f'{{"city_filter": "{city or "all"}"}}'
    })
    await db.commit()

    if city and city != "all":
        sql = "SELECT * FROM blind_date_responses WHERE deleted_at IS NULL AND city_id = :city ORDER BY submitted_at DESC;"
        result = await db.execute(text(sql), {"city": city})
    else:
        sql = "SELECT * FROM blind_date_responses WHERE deleted_at IS NULL ORDER BY submitted_at DESC;"
        result = await db.execute(text(sql))

    rows = result.fetchall()
    responses = []
    for r in rows:
        decrypted_email = decrypt_text(r.contact_email)
        decrypted_phone = decrypt_text(r.contact_phone)
        decrypted_ans = decrypt_json(r.answers)

        responses.append({
            "id": r.id,
            "submitted_at": r.submitted_at,
            "city_id": r.city_id,
            "contact_email": decrypted_email,
            "contact_phone": decrypted_phone,
            "answers": decrypted_ans,
            "photo_urls": r.photo_urls or [],
            "consent_accepted_at": r.consent_accepted_at,
            "status": r.status or "new",
            "jurisdiction": r.jurisdiction,
            "retention_days": r.retention_days or 365,
        })
    return responses


@router.delete("/blind-date-responses/{response_id}")
async def soft_delete_response(
    response_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Derecho al Olvido / ARCO Habeas Data: Soft delete de una respuesta de usuario.
    """
    user_email = current_user.get("email", "admin@dailylover.com")
    now = datetime.now(timezone.utc)

    result = await db.execute(text("""
        UPDATE blind_date_responses
        SET deleted_at = :now
        WHERE id::text = :response_id AND deleted_at IS NULL
        RETURNING id;
    """), {"now": now, "response_id": str(response_id)})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Respuesta no encontrada o ya eliminada.")

    # Record Audit Log
    await db.execute(text("""
        INSERT INTO blind_date_audit_logs (user_email, action, response_id, details)
        VALUES (:email, 'SOFT_DELETE_RESPONSE', :resp_id, CAST(:details AS jsonb));
    """), {
        "email": user_email,
        "resp_id": str(response_id),
        "details": '{"reason": "User Habeas Data Request / Admin deletion"}'
    })
    await db.commit()

    return {"status": "success", "message": f"Respuesta {response_id} eliminada por solicitud de Habeas Data."}


@router.get("/blind-date-audit-logs")
async def get_audit_logs(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Consulta de logs de auditoría de accesos a datos sensibles.
    """
    result = await db.execute(text("""
        SELECT id, user_email, action, response_id, details, created_at
        FROM blind_date_audit_logs
        ORDER BY created_at DESC
        LIMIT :limit;
    """), {"limit": limit})
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]
