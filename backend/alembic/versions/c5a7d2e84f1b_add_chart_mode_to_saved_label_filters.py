"""add chart_mode to saved_label_filters

Revision ID: c5a7d2e84f1b
Revises: d8e3a1b92f5c
Create Date: 2026-04-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c5a7d2e84f1b'
down_revision: Union[str, Sequence[str], None] = 'd8e3a1b92f5c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'saved_label_filters',
        sa.Column('chart_mode', sa.String(10), nullable=False, server_default='holding'),
    )


def downgrade() -> None:
    op.drop_column('saved_label_filters', 'chart_mode')
