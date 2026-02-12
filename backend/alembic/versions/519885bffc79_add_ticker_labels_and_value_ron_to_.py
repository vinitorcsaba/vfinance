"""add ticker labels and value_ron to snapshot_items

Revision ID: 519885bffc79
Revises: 375fe1c58404
Create Date: 2026-02-12 23:09:52.833855

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '519885bffc79'
down_revision: Union[str, Sequence[str], None] = '375fe1c58404'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Use batch mode for SQLite compatibility
    with op.batch_alter_table('snapshot_items') as batch_op:
        batch_op.add_column(sa.Column('ticker', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('labels', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('value_ron', sa.Float(), nullable=False, server_default='0.0'))

    # Remove server_default after adding (only needed for existing rows)
    with op.batch_alter_table('snapshot_items') as batch_op:
        batch_op.alter_column('value_ron', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('snapshot_items') as batch_op:
        batch_op.drop_column('value_ron')
        batch_op.drop_column('labels')
        batch_op.drop_column('ticker')
