import uuid
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field


# ─── CITY SCHEMAS ─────────────────────────────────────────────────────────────

class CityBase(BaseModel):
    id: str = Field(..., description="Slug de la ciudad, e.g. 'colombia', 'miami'")
    name: str
    tagline: Optional[str] = None
    hero_badge: Optional[str] = None
    hero_title: str
    hero_subtitle: Optional[str] = None
    hero_image_url: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    currency: Optional[str] = "USD"
    whatsapp_number: Optional[str] = None
    whatsapp_message: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0


class CityCreate(CityBase):
    pass


class CityUpdate(BaseModel):
    name: Optional[str] = None
    tagline: Optional[str] = None
    hero_badge: Optional[str] = None
    hero_title: Optional[str] = None
    hero_subtitle: Optional[str] = None
    hero_image_url: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    currency: Optional[str] = None
    whatsapp_number: Optional[str] = None
    whatsapp_message: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class CityResponse(CityBase):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── EVENT SCHEMAS ────────────────────────────────────────────────────────────

class EventBase(BaseModel):
    city_id: Optional[str] = None
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    event_date: Optional[date] = None
    event_time: Optional[str] = None
    venue: Optional[str] = None
    cta_label: str
    cta_url: str
    provider: Optional[str] = "other"  # 'stripe', 'ticketmaster', 'fourvenues', 'tally', 'other'
    status: Optional[str] = "published"  # 'draft', 'published', 'past'
    sort_order: int = 0


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    city_id: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    event_date: Optional[date] = None
    event_time: Optional[str] = None
    venue: Optional[str] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None
    provider: Optional[str] = None
    status: Optional[str] = None
    sort_order: Optional[int] = None


class EventResponse(EventBase):
    id: Any
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── BLIND DATE FORM FIELD SCHEMAS ────────────────────────────────────────────

class FormFieldBase(BaseModel):
    field_key: str
    label: str
    field_type: str  # 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'date' | 'photo_upload'
    options: Optional[List[str]] = None
    is_required: bool = False
    sort_order: int = 0
    is_active: bool = True


class FormFieldCreate(FormFieldBase):
    pass


class FormFieldUpdate(BaseModel):
    label: Optional[str] = None
    field_type: Optional[str] = None
    options: Optional[List[str]] = None
    is_required: Optional[bool] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class FormFieldResponse(FormFieldBase):
    id: uuid.UUID
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── BLIND DATE RESPONSE SCHEMAS ──────────────────────────────────────────────

class BlindDateSubmit(BaseModel):
    city_id: Optional[str] = "colombia"
    contact_email: str
    contact_phone: str
    answers: Dict[str, Any]
    photo_urls: Optional[List[str]] = []
    accept_terms: bool  # Consentimiento explícito obligatorio


class BlindDateResponseDetail(BaseModel):
    id: uuid.UUID
    submitted_at: datetime
    city_id: Optional[str] = None
    contact_email: Optional[str] = None  # Decrypted for admin view
    contact_phone: Optional[str] = None  # Decrypted for admin view
    answers: Dict[str, Any] = {}          # Decrypted for admin view
    photo_urls: Optional[List[str]] = []
    consent_accepted_at: datetime
    status: str
    jurisdiction: Optional[str] = None
    retention_days: int = 365

    class Config:
        from_attributes = True
