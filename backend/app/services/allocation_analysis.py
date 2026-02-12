import logging
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.allocation_group import (
    AllocationGroup,
    manual_allocation_groups,
    stock_allocation_groups,
)
from app.schemas.allocation_group import (
    AllocationGroupAnalysis,
    AllocationMemberAnalysis,
)
from app.services.portfolio import build_portfolio

logger = logging.getLogger(__name__)


def calculate_allocation_analysis(
    db: Session, group_id: int, display_currency: str = "RON"
) -> AllocationGroupAnalysis:
    """Calculate rebalancing analysis for an allocation group.

    Args:
        db: Database session
        group_id: ID of the allocation group
        display_currency: Currency to display totals in (default RON)

    Returns:
        AllocationGroupAnalysis with current vs target allocations and suggestions
    """
    # Get the group
    group = db.query(AllocationGroup).filter(AllocationGroup.id == group_id).first()
    if not group:
        raise ValueError(f"Allocation group {group_id} not found")

    # Query junction tables to get all members with target percentages
    stock_members = db.execute(
        select(
            stock_allocation_groups.c.stock_holding_id,
            stock_allocation_groups.c.target_percentage,
        ).where(stock_allocation_groups.c.allocation_group_id == group_id)
    ).fetchall()

    manual_members = db.execute(
        select(
            manual_allocation_groups.c.manual_holding_id,
            manual_allocation_groups.c.target_percentage,
        ).where(manual_allocation_groups.c.allocation_group_id == group_id)
    ).fetchall()

    # Build lookup: (holding_type, holding_id) -> target_percentage
    target_percentages: dict[tuple[Literal["stock", "manual"], int], float] = {}
    for stock_id, target_pct in stock_members:
        target_percentages[("stock", stock_id)] = target_pct
    for manual_id, target_pct in manual_members:
        target_percentages[("manual", manual_id)] = target_pct

    # Get current portfolio with values
    portfolio = build_portfolio(db)
    fx_rates = portfolio["fx_rates"]

    # Filter portfolio holdings to group members only
    group_holdings = []
    for holding in portfolio["holdings"]:
        holding_type = holding["type"]
        holding_id = holding["id"]
        key = (holding_type, holding_id)
        if key in target_percentages:
            group_holdings.append({
                **holding,
                "target_percentage": target_percentages[key],
            })

    # Calculate total group value in RON
    total_group_value_ron = sum(h["value_ron"] for h in group_holdings)

    # Convert to display currency
    display_rate = fx_rates.get(display_currency, 1.0)
    total_value_display = round(total_group_value_ron / display_rate, 2)

    # Calculate analysis for each member
    members_analysis = []
    for holding in group_holdings:
        current_value = holding["value"]
        current_value_ron = holding["value_ron"]
        currency = holding["currency"]
        target_pct = holding["target_percentage"]

        # Calculate actual percentage
        if total_group_value_ron > 0:
            actual_pct = round((current_value_ron / total_group_value_ron) * 100, 2)
        else:
            actual_pct = 0.0

        # Calculate target value in RON
        target_value_ron = (target_pct / 100) * total_group_value_ron

        # Convert target value to native currency
        currency_rate = fx_rates.get(currency, 1.0)
        target_value_native = round(target_value_ron / currency_rate, 2)

        # Calculate difference in native currency
        difference = round(target_value_native - current_value, 2)

        members_analysis.append(
            AllocationMemberAnalysis(
                holding_type=holding["type"],
                holding_id=holding["id"],
                name=holding["name"],
                ticker=holding.get("ticker"),
                currency=currency,
                current_value=current_value,
                current_percentage=actual_pct,
                target_percentage=target_pct,
                target_value=target_value_native,
                difference=difference,
            )
        )

    return AllocationGroupAnalysis(
        group_id=group.id,
        group_name=group.name,
        group_color=group.color,
        total_value_ron=round(total_group_value_ron, 2),
        total_value_display=total_value_display,
        display_currency=display_currency,
        members=members_analysis,
        fx_rates=fx_rates,
    )
