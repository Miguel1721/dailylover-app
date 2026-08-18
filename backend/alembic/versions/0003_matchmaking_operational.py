"""create_matchmaking_operational_tables

Revision ID: 0003_matchmaking_operational
Revises: 0002_cms_tables
Create Date: 2026-08-17 21:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0003_matchmaking_operational'
down_revision: Union[str, None] = '0002_cms_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Operational Matches table
    op.execute("""
        CREATE TABLE IF NOT EXISTS operational_matches (
            id SERIAL PRIMARY KEY,
            person_a VARCHAR(255) NOT NULL,
            person_b VARCHAR(255),
            user_id_a INTEGER REFERENCES users(id) ON DELETE SET NULL,
            user_id_b INTEGER REFERENCES users(id) ON DELETE SET NULL,
            psychologist_name VARCHAR(100) NOT NULL,
            psychologist_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            city TEXT,
            pref TEXT,
            plan_tier TEXT,
            status TEXT DEFAULT 'Listo para match',
            approved_by_maria BOOLEAN DEFAULT FALSE,
            approved_at TIMESTAMP,
            observations TEXT,
            slot_number INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_op_matches_psychologist ON operational_matches(psychologist_name)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_op_matches_status ON operational_matches(status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_op_matches_approved ON operational_matches(approved_by_maria)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_op_matches_person_a ON operational_matches(person_a)")

    # 2. Match Confirmations table (Servicio al Cliente)
    op.execute("""
        CREATE TABLE IF NOT EXISTS match_confirmations (
            id SERIAL PRIMARY KEY,
            match_id INTEGER NOT NULL REFERENCES operational_matches(id) ON DELETE CASCADE,
            person_a_confirmation VARCHAR(50) DEFAULT 'Pendiente',
            person_b_confirmation VARCHAR(50) DEFAULT 'Pendiente',
            stage VARCHAR(50) DEFAULT 'pendientes',
            pause_reason VARCHAR(100),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_match_conf_stage ON match_confirmations(stage)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_match_conf_match_id ON match_confirmations(match_id)")

    # 3. Scheduled Dates table (Calendario & WhatsApp)
    op.execute("""
        CREATE TABLE IF NOT EXISTS scheduled_dates (
            id SERIAL PRIMARY KEY,
            match_id INTEGER REFERENCES operational_matches(id) ON DELETE SET NULL,
            person_a VARCHAR(200) NOT NULL,
            person_b VARCHAR(200) NOT NULL,
            date_time VARCHAR(100),
            venue VARCHAR(200),
            city VARCHAR(100),
            reservation_name VARCHAR(100) DEFAULT 'María Paula Salinas',
            had_date BOOLEAN DEFAULT FALSE,
            feedback TEXT,
            reschedule BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_sched_dates_match ON scheduled_dates(match_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sched_dates_city ON scheduled_dates(city)")

    # 4. Person History table
    op.execute("""
        CREATE TABLE IF NOT EXISTS person_history (
            id SERIAL PRIMARY KEY,
            person_name VARCHAR(200) NOT NULL,
            match_id INTEGER REFERENCES operational_matches(id) ON DELETE SET NULL,
            event_type VARCHAR(50) NOT NULL,
            details TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_person_hist_name ON person_history(lower(person_name))")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS person_history CASCADE")
    op.execute("DROP TABLE IF EXISTS scheduled_dates CASCADE")
    op.execute("DROP TABLE IF EXISTS match_confirmations CASCADE")
    op.execute("DROP TABLE IF EXISTS operational_matches CASCADE")
