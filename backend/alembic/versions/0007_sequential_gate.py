"""sequential_gate

Adds operational_matches.sequential_gate (boolean, default false): marks slots
belonging to a multi-date plan created from this change onward, so that
slot N stays locked in Matches Psicóloga until slot N-1 reaches status
'CITA REALIZADA'. Purely additive — existing rows keep the default (false)
and are not affected.

Revision ID: 0007_sequential_gate
Revises: 0006_august27_and_atrasados_role
Create Date: 2026-09-28 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0007_sequential_gate'
down_revision: Union[str, None] = '0006_august27_and_atrasados_role'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE operational_matches ADD COLUMN IF NOT EXISTS sequential_gate BOOLEAN NOT NULL DEFAULT false")
    op.execute("CREATE INDEX IF NOT EXISTS idx_operational_matches_seq_gate ON operational_matches(person_a, slot_number) WHERE sequential_gate = true")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_operational_matches_seq_gate")
    op.execute("ALTER TABLE operational_matches DROP COLUMN IF EXISTS sequential_gate")
