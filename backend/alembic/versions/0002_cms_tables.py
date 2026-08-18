"""add_cities_events_and_blind_date_tables

Revision ID: 0002_cms_tables
Revises: 0001_baseline
Create Date: 2026-08-08 11:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0002_cms_tables'
down_revision: Union[str, None] = '0001_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create cities table
    op.execute("""
        CREATE TABLE IF NOT EXISTS cities (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            tagline TEXT,
            hero_badge TEXT,
            hero_title TEXT NOT NULL,
            hero_subtitle TEXT,
            hero_image_url TEXT,
            cta_text TEXT,
            cta_url TEXT,
            currency TEXT,
            whatsapp_number TEXT,
            whatsapp_message TEXT,
            is_active BOOLEAN DEFAULT true,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
    """)

    # 2. Add columns to events table safely (handles existing legacy columns)
    op.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            title TEXT,
            status VARCHAR(50) DEFAULT 'draft',
            created_at TIMESTAMPTZ DEFAULT now()
        );
        ALTER TABLE events ADD COLUMN IF NOT EXISTS city_id TEXT REFERENCES cities(id);
        ALTER TABLE events ADD COLUMN IF NOT EXISTS title TEXT;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS subtitle TEXT;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS event_date DATE;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS event_time TEXT;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS venue TEXT;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS cta_label TEXT;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS cta_url TEXT;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS provider TEXT;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
    """)

    # 3. Create blind_date_form_fields table
    op.execute("""
        CREATE TABLE IF NOT EXISTS blind_date_form_fields (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            field_key TEXT UNIQUE NOT NULL,
            label TEXT NOT NULL,
            field_type TEXT NOT NULL,
            options JSONB,
            is_required BOOLEAN DEFAULT false,
            sort_order INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
    """)

    # 4. Create blind_date_responses table
    op.execute("""
        CREATE TABLE IF NOT EXISTS blind_date_responses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            submitted_at TIMESTAMPTZ DEFAULT now(),
            city_id TEXT REFERENCES cities(id),
            answers TEXT NOT NULL,
            photo_urls TEXT[],
            contact_email TEXT,
            contact_phone TEXT,
            consent_accepted_at TIMESTAMPTZ NOT NULL,
            status TEXT DEFAULT 'new',
            ip_address INET,
            jurisdiction TEXT,
            retention_days INTEGER DEFAULT 365,
            deleted_at TIMESTAMPTZ
        );
    """)

    # 5. Create blind_date_audit_logs table
    op.execute("""
        CREATE TABLE IF NOT EXISTS blind_date_audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_account_id INT,
            user_email TEXT NOT NULL,
            action TEXT NOT NULL,
            response_id UUID,
            details JSONB,
            created_at TIMESTAMPTZ DEFAULT now()
        );
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS blind_date_audit_logs CASCADE;")
    op.execute("DROP TABLE IF EXISTS blind_date_responses CASCADE;")
    op.execute("DROP TABLE IF EXISTS blind_date_form_fields CASCADE;")
    op.execute("DROP TABLE IF EXISTS events CASCADE;")
    op.execute("DROP TABLE IF EXISTS cities CASCADE;")
