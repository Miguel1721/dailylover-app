"""Renombra el plan de 650k: 'Plan VIP 650k' -> 'Matchmaking Service (3 citas)'

Revision ID: 0010_rename_plan_650k
Revises: 0009_interview_no_shows
Create Date: 2026-09-29 20:00:00.000000

El plan de 650k NO es un plan VIP (el VIP es solo el de 195k). Se cambia el nombre guardado en
todas las tablas que tengan columnas plan_tier / person_b_plan_tier. Solo toca valores que
contengan 'vip' y '650' a la vez; el resto de planes no se modifica.
El nombre nuevo incluye '(3 citas)' porque las reglas de cupo leen ese número.
"""
from typing import Sequence, Union
from alembic import op

revision: str = '0010_rename_plan_650k'
down_revision: Union[str, None] = '0009_interview_no_shows'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        DO $$
        DECLARE r record;
        BEGIN
          FOR r IN
            SELECT c.table_name, c.column_name
            FROM information_schema.columns c
            JOIN information_schema.tables t
              ON t.table_schema = c.table_schema AND t.table_name = c.table_name
            WHERE c.table_schema = 'public'
              AND t.table_type = 'BASE TABLE'
              AND c.column_name IN ('plan_tier', 'person_b_plan_tier')
              AND c.data_type IN ('text', 'character varying')
          LOOP
            EXECUTE format(
              'UPDATE %I SET %I = %L WHERE %I ~* %L',
              r.table_name, r.column_name, 'Matchmaking Service (3 citas)',
              r.column_name, '(vip.*650|650.*vip)'
            );
          END LOOP;
        END $$;
    """)


def downgrade() -> None:
    # No se revierte: no es posible distinguir qué filas eran 'Plan VIP 650k' antes del cambio.
    pass
