"""add_total_value_eur_usd_to_snapshot

Revision ID: 025a911d81bd
Revises: c73d2359958c
Create Date: 2026-02-14 17:29:34.301914

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '025a911d81bd'
down_revision: Union[str, Sequence[str], None] = 'c73d2359958c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add total_value_eur and total_value_usd columns to snapshots table."""
    # Add columns with default value 0.0 (will be updated below)
    op.add_column('snapshots', sa.Column('total_value_eur', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('snapshots', sa.Column('total_value_usd', sa.Float(), nullable=False, server_default='0.0'))

    # Update existing snapshots by calculating totals from their snapshot_items
    # This uses a subquery to sum up value_eur and value_usd from snapshot_items
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE snapshots
        SET total_value_eur = (
            SELECT COALESCE(SUM(value_eur), 0.0)
            FROM snapshot_items
            WHERE snapshot_items.snapshot_id = snapshots.id
        ),
        total_value_usd = (
            SELECT COALESCE(SUM(value_usd), 0.0)
            FROM snapshot_items
            WHERE snapshot_items.snapshot_id = snapshots.id
        )
    """))


def downgrade() -> None:
    """Remove total_value_eur and total_value_usd columns from snapshots table."""
    op.drop_column('snapshots', 'total_value_usd')
    op.drop_column('snapshots', 'total_value_eur')
