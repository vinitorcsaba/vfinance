"""add saved label filters

Revision ID: d8e3a1b92f5c
Revises: 6ebb0051e754
Create Date: 2026-04-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd8e3a1b92f5c'
down_revision: Union[str, Sequence[str], None] = '6ebb0051e754'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'saved_label_filters',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('label_ids', sa.Text(), nullable=False),
        sa.Column('filter_mode', sa.String(3), nullable=False, server_default='AND'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('saved_label_filters')
