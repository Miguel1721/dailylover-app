import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Date,
    DateTime,
    ForeignKey,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY, INET
from app.database import Base


class City(Base):
    __tablename__ = "cities"

    id = Column(String, primary_key=True)  # slug: 'colombia', 'miami', 'madrid', 'cdmx'
    name = Column(String, nullable=False)
    tagline = Column(String, nullable=True)
    hero_badge = Column(String, nullable=True)
    hero_title = Column(String, nullable=False)
    hero_subtitle = Column(String, nullable=True)
    hero_image_url = Column(String, nullable=True)
    cta_text = Column(String, nullable=True)
    cta_url = Column(String, nullable=True)
    currency = Column(String, nullable=True)
    whatsapp_number = Column(String, nullable=True)
    whatsapp_message = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    city_id = Column(String, ForeignKey("cities.id"), nullable=True)
    title = Column(String, nullable=False)
    subtitle = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    event_date = Column(Date, nullable=True)
    event_time = Column(String, nullable=True)
    venue = Column(String, nullable=True)
    cta_label = Column(String, nullable=False)
    cta_url = Column(String, nullable=False)
    provider = Column(String, nullable=True)  # 'stripe' | 'ticketmaster' | 'fourvenues' | 'tally' | 'other'
    status = Column(String, default="draft")  # 'draft' | 'published' | 'past'
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BlindDateFormField(Base):
    __tablename__ = "blind_date_form_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    field_key = Column(String, unique=True, nullable=False)  # 'edad', 'ciudad', etc.
    label = Column(String, nullable=False)
    field_type = Column(String, nullable=False)  # 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'date' | 'photo_upload'
    options = Column(JSONB, nullable=True)  # ["Opción 1", "Opción 2"]
    is_required = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BlindDateResponse(Base):
    __tablename__ = "blind_date_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    city_id = Column(String, ForeignKey("cities.id"), nullable=True)
    answers = Column(Text, nullable=False)  # Cifrado Fernet (Base64 string)
    photo_urls = Column(ARRAY(String), nullable=True)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    consent_accepted_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String, default="new")  # 'new' | 'reviewed' | 'matched' | 'archived'
    ip_address = Column(INET, nullable=True)
    jurisdiction = Column(String, nullable=True)  # 'co' | 'mx' | 'es' | 'us_fl'
    retention_days = Column(Integer, default=365)
    deleted_at = Column(DateTime(timezone=True), nullable=True)  # Soft delete


class BlindDateAuditLog(Base):
    __tablename__ = "blind_date_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_account_id = Column(Integer, nullable=True)
    user_email = Column(String, nullable=False)
    action = Column(String, nullable=False)  # 'VIEW_RESPONSE' | 'DELETE_RESPONSE' | 'EXPORT_DATA'
    response_id = Column(UUID(as_uuid=True), nullable=True)
    details = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
