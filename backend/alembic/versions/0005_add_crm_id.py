"""add_crm_id_columns

Revision ID: 0005_add_crm_id
Revises: 0004_functional_indexes
Create Date: 2026-08-18 10:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0005_add_crm_id'
down_revision: Union[str, None] = '0004_functional_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add crm_id to users
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS crm_id VARCHAR(50)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_crm_id ON users (crm_id)")

    # 2. Add crm_id columns to operational_matches
    op.execute("ALTER TABLE operational_matches ADD COLUMN IF NOT EXISTS person_a_crm_id VARCHAR(50)")
    op.execute("ALTER TABLE operational_matches ADD COLUMN IF NOT EXISTS person_b_crm_id VARCHAR(50)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_op_matches_persona_a_crm_id ON operational_matches (person_a_crm_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_op_matches_persona_b_crm_id ON operational_matches (person_b_crm_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_op_matches_persona_b_crm_id")
    op.execute("DROP INDEX IF EXISTS idx_op_matches_persona_a_crm_id")
    op.execute("ALTER TABLE operational_matches DROP COLUMN IF EXISTS person_b_crm_id")
    op.execute("ALTER TABLE operational_matches DROP COLUMN IF EXISTS person_a_crm_id")
    op.execute("DROP INDEX IF EXISTS idx_users_crm_id")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS crm_id")
