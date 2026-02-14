"""add_transactions_table

Revision ID: ec7b07f140cd
Revises: 025a911d81bd
Create Date: 2026-02-14 17:47:03.886603

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ec7b07f140cd'
down_revision: Union[str, Sequence[str], None] = '025a911d81bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create transactions table for tracking stock holding purchases/sales."""
    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('holding_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('shares', sa.Float(), nullable=False),
        sa.Column('price_per_share', sa.Float(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['holding_id'], ['stock_holdings.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Drop transactions table."""
    op.drop_table('transactions')
