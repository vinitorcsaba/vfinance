"""add allocation groups

Revision ID: 4e6f14ebf5fe
Revises: 519885bffc79
Create Date: 2026-02-12 23:36:05.169717

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4e6f14ebf5fe'
down_revision: Union[str, Sequence[str], None] = '519885bffc79'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create allocation_groups table
    op.create_table('allocation_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('color', sa.String(length=7), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Create stock_allocation_groups junction table
    op.create_table('stock_allocation_groups',
        sa.Column('stock_holding_id', sa.Integer(), nullable=False),
        sa.Column('allocation_group_id', sa.Integer(), nullable=False),
        sa.Column('target_percentage', sa.Float(), nullable=False),
        sa.CheckConstraint('target_percentage > 0 AND target_percentage <= 100', name='stock_target_percentage_check'),
        sa.ForeignKeyConstraint(['allocation_group_id'], ['allocation_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['stock_holding_id'], ['stock_holdings.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('stock_holding_id', 'allocation_group_id')
    )

    # Create manual_allocation_groups junction table
    op.create_table('manual_allocation_groups',
        sa.Column('manual_holding_id', sa.Integer(), nullable=False),
        sa.Column('allocation_group_id', sa.Integer(), nullable=False),
        sa.Column('target_percentage', sa.Float(), nullable=False),
        sa.CheckConstraint('target_percentage > 0 AND target_percentage <= 100', name='manual_target_percentage_check'),
        sa.ForeignKeyConstraint(['allocation_group_id'], ['allocation_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['manual_holding_id'], ['manual_holdings.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('manual_holding_id', 'allocation_group_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('manual_allocation_groups')
    op.drop_table('stock_allocation_groups')
    op.drop_table('allocation_groups')
