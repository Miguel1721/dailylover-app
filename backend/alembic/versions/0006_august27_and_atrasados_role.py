"""august27_and_atrasados_role

Revision ID: 0006_august27_and_atrasados_role
Revises: 0005_add_crm_id
Create Date: 2026-09-14 17:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0006_august27_and_atrasados_role'
down_revision: Union[str, None] = '0005_add_crm_id'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create table august27_ai_match_proposals if not exists
    op.execute("""
        CREATE TABLE IF NOT EXISTS august27_ai_match_proposals (
            id SERIAL PRIMARY KEY,
            sheet_row INT,
            client_name TEXT,
            client_user_id INT,
            client_crm_id TEXT,
            dates_pend TEXT,
            responsable TEXT,
            candidate_name TEXT,
            candidate_user_id INT,
            candidate_crm_id TEXT,
            punctuation TEXT,
            status TEXT,
            points_to_consider TEXT,
            strong_points TEXT,
            decision TEXT DEFAULT 'pending',
            decided_at TIMESTAMP WITH TIME ZONE,
            decided_by TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_aug27_client_uid ON august27_ai_match_proposals(client_user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_aug27_sheet_row ON august27_ai_match_proposals(sheet_row)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_aug27_decision ON august27_ai_match_proposals(decision)")

    # Ensure decision columns exist if table was already created prior to this migration
    op.execute("ALTER TABLE august27_ai_match_proposals ADD COLUMN IF NOT EXISTS decision TEXT DEFAULT 'pending'")
    op.execute("ALTER TABLE august27_ai_match_proposals ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE august27_ai_match_proposals ADD COLUMN IF NOT EXISTS decided_by TEXT")

    # 2. Create table august27_unmatched_clients if not exists
    op.execute("""
        CREATE TABLE IF NOT EXISTS august27_unmatched_clients (
            id SERIAL PRIMARY KEY,
            sheet_row INT,
            sheet_name TEXT,
            clean_name TEXT,
            dates_pend TEXT,
            responsable TEXT,
            nota TEXT,
            reason TEXT DEFAULT 'No encontrado en base de datos',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_aug27_unmatched_row ON august27_unmatched_clients(sheet_row)")

    # 3. Add batch_tag to operational_matches
    op.execute("ALTER TABLE operational_matches ADD COLUMN IF NOT EXISTS batch_tag TEXT")
    op.execute("CREATE INDEX IF NOT EXISTS idx_operational_matches_batch_tag ON operational_matches(batch_tag)")

    # 4. Create role atrasados_only in roles
    op.execute("""
        INSERT INTO roles (name, is_system) 
        VALUES ('atrasados_only', false)
        ON CONFLICT (name) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_operational_matches_batch_tag")
    op.execute("ALTER TABLE operational_matches DROP COLUMN IF EXISTS batch_tag")
    op.execute("DROP INDEX IF EXISTS idx_aug27_unmatched_row")
    op.execute("DROP TABLE IF EXISTS august27_unmatched_clients")
    op.execute("DROP INDEX IF EXISTS idx_aug27_decision")
    op.execute("DROP INDEX IF EXISTS idx_aug27_sheet_row")
    op.execute("DROP INDEX IF EXISTS idx_aug27_client_uid")
    op.execute("DROP TABLE IF EXISTS august27_ai_match_proposals")
