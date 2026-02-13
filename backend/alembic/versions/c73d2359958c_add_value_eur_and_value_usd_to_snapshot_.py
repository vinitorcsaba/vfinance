"""add value_eur and value_usd to snapshot_items

Revision ID: c73d2359958c
Revises: 4e6f14ebf5fe
Create Date: 2026-02-13 19:38:45.275693

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c73d2359958c'
down_revision: Union[str, Sequence[str], None] = '4e6f14ebf5fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _fetch_current_fx_rates() -> dict[str, float]:
    """Fetch current FX rates for data migration."""
    try:
        import yfinance as yf

        rates = {"RON": 1.0}
        fx_pairs = {"EUR": "EURRON=X", "USD": "USDRON=X"}

        for currency, ticker in fx_pairs.items():
            try:
                t = yf.Ticker(ticker)
                rate = t.fast_info["last_price"]
                rates[currency] = round(rate, 4)
            except Exception:
                # Fallback rates if fetch fails
                fallback = {"EUR": 5.0, "USD": 4.5}
                rates[currency] = fallback[currency]

        return rates
    except ImportError:
        # If yfinance not available, use fallback
        return {"RON": 1.0, "EUR": 5.0, "USD": 4.5}


def upgrade() -> None:
    """Upgrade schema."""
    # Add new columns with server_default for existing rows
    with op.batch_alter_table('snapshot_items') as batch_op:
        batch_op.add_column(sa.Column('value_eur', sa.Float(), nullable=False, server_default='0.0'))
        batch_op.add_column(sa.Column('value_usd', sa.Float(), nullable=False, server_default='0.0'))

    # Remove server_default after adding (only needed for existing rows)
    with op.batch_alter_table('snapshot_items') as batch_op:
        batch_op.alter_column('value_eur', server_default=None)
        batch_op.alter_column('value_usd', server_default=None)

    # Backfill existing data using current exchange rates
    connection = op.get_bind()

    # Fetch current FX rates
    fx_rates = _fetch_current_fx_rates()

    # Get all snapshot items
    items = connection.execute(sa.text("SELECT id, value, currency FROM snapshot_items")).fetchall()

    # Convert each item to all three currencies
    for item_id, value, currency in items:
        # Convert to RON first
        rate_to_ron = fx_rates.get(currency, 1.0)
        value_ron = value * rate_to_ron

        # Convert RON to EUR and USD
        value_eur = value_ron / fx_rates["EUR"]
        value_usd = value_ron / fx_rates["USD"]

        # Update the row
        connection.execute(
            sa.text("UPDATE snapshot_items SET value_eur = :eur, value_usd = :usd WHERE id = :id"),
            {"eur": round(value_eur, 2), "usd": round(value_usd, 2), "id": item_id}
        )

    connection.commit()


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('snapshot_items') as batch_op:
        batch_op.drop_column('value_usd')
        batch_op.drop_column('value_eur')
