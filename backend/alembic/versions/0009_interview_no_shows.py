"""interview_no_shows: contador de inasistencias a la entrevista clínica

Revision ID: 0009_interview_no_shows
Revises: 0008_match_observations
Create Date: 2026-09-29 15:00:00.000000

Solo aplica a entrevistas (no a citas en restaurante). Límite: 3 inasistencias.
"""
from typing import Sequence, Union
from alembic import op

revision: str = '0009_interview_no_shows'
down_revision: Union[str, None] = '0008_match_observations'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE IF EXISTS leads_pendientes_entrevista ADD COLUMN IF NOT EXISTS interview_no_shows INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE IF EXISTS leads_pendientes_entrevista ADD COLUMN IF NOT EXISTS last_no_show_at TIMESTAMP")


def downgrade() -> None:
    op.execute("ALTER TABLE IF EXISTS leads_pendientes_entrevista DROP COLUMN IF EXISTS last_no_show_at")
    op.execute("ALTER TABLE IF EXISTS leads_pendientes_entrevista DROP COLUMN IF EXISTS interview_no_shows")
