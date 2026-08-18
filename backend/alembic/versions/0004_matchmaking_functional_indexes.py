"""add_matchmaking_functional_indexes

Revision ID: 0004_matchmaking_functional_indexes
Revises: 0003_matchmaking_operational
Create Date: 2026-08-18 10:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0004_functional_indexes'
down_revision: Union[str, None] = '0003_matchmaking_operational'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Extensions for fast text search and trigram matching
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # 2. Functional B-Tree Indexes matching exact query expressions
    op.execute("CREATE INDEX IF NOT EXISTS idx_op_matches_psyc_upper ON operational_matches (UPPER(psychologist_name))")
    op.execute("CREATE INDEX IF NOT EXISTS idx_op_matches_status_upper ON operational_matches (UPPER(status))")
    op.execute("CREATE INDEX IF NOT EXISTS idx_op_matches_persona_a_lower ON operational_matches (LOWER(TRIM(person_a)))")
    op.execute("CREATE INDEX IF NOT EXISTS idx_op_matches_persona_b_lower ON operational_matches (LOWER(TRIM(person_b)))")
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_name_lower ON users (LOWER(TRIM(name)))")

    # 3. GIN Trigram Indexes for free text / ILIKE queries
    op.execute("CREATE INDEX IF NOT EXISTS idx_op_matches_persona_a_trgm ON operational_matches USING gin (person_a gin_trgm_ops)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_op_matches_persona_b_trgm ON operational_matches USING gin (person_b gin_trgm_ops)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_op_matches_persona_b_trgm")
    op.execute("DROP INDEX IF EXISTS idx_op_matches_persona_a_trgm")
    op.execute("DROP INDEX IF EXISTS idx_users_name_lower")
    op.execute("DROP INDEX IF EXISTS idx_op_matches_persona_b_lower")
    op.execute("DROP INDEX IF EXISTS idx_op_matches_persona_a_lower")
    op.execute("DROP INDEX IF EXISTS idx_op_matches_status_upper")
    op.execute("DROP INDEX IF EXISTS idx_op_matches_psyc_upper")
