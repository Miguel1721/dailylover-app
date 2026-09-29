"""match_observations: historial de observaciones por match (con autor)

Revision ID: 0008_match_observations
Revises: 0007_sequential_gate
Create Date: 2026-09-29 12:00:00.000000

Cada observación es un comentario independiente (autor, rol, fecha); nada se sobrescribe.
El texto existente en operational_matches.observations se conserva como primer comentario
'histórico' de cada match.
"""
from typing import Sequence, Union
from alembic import op

revision: str = '0008_match_observations'
down_revision: Union[str, None] = '0007_sequential_gate'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS match_observations (
            id SERIAL PRIMARY KEY,
            match_id INTEGER NOT NULL REFERENCES operational_matches(id) ON DELETE CASCADE,
            author_id INTEGER,
            author_name VARCHAR(150) NOT NULL,
            author_role VARCHAR(100),
            body TEXT NOT NULL,
            source VARCHAR(20) NOT NULL DEFAULT 'manual',
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_match_observations_match ON match_observations (match_id, created_at)")
    # Conserva lo escrito hasta hoy como primer comentario histórico (idempotente).
    op.execute("""
        INSERT INTO match_observations (match_id, author_name, author_role, body, source, created_at)
        SELECT m.id, 'Histórico', NULL, TRIM(m.observations), 'legacy', COALESCE(m.created_at, NOW())
        FROM operational_matches m
        WHERE m.observations IS NOT NULL AND TRIM(m.observations) <> ''
          AND NOT EXISTS (SELECT 1 FROM match_observations o WHERE o.match_id = m.id AND o.source = 'legacy')
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS match_observations")
