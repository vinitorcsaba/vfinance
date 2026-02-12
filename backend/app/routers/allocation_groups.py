from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.allocation_group import (
    AllocationGroup,
    manual_allocation_groups,
    stock_allocation_groups,
)
from app.models.holding import ManualHolding, StockHolding
from app.schemas.allocation_group import (
    AllocationGroupAnalysis,
    AllocationGroupCreate,
    AllocationGroupRead,
    AllocationGroupUpdate,
    AllocationMemberRead,
    AssignAllocations,
)
from app.services.allocation_analysis import calculate_allocation_analysis

router = APIRouter(
    prefix="/api/v1/allocation-groups",
    tags=["allocation-groups"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[AllocationGroupRead])
def list_allocation_groups(db: Session = Depends(get_db)):
    """List all allocation groups."""
    return db.query(AllocationGroup).order_by(AllocationGroup.name).all()


@router.post("", response_model=AllocationGroupRead, status_code=201)
def create_allocation_group(body: AllocationGroupCreate, db: Session = Depends(get_db)):
    """Create a new allocation group."""
    existing = db.query(AllocationGroup).filter(AllocationGroup.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Allocation group '{body.name}' already exists")
    group = AllocationGroup(name=body.name, color=body.color)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.put("/{group_id}", response_model=AllocationGroupRead)
def update_allocation_group(
    group_id: int, body: AllocationGroupUpdate, db: Session = Depends(get_db)
):
    """Update an allocation group."""
    group = db.get(AllocationGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Allocation group not found")
    update_data = body.model_dump(exclude_unset=True)
    if "name" in update_data:
        conflict = (
            db.query(AllocationGroup)
            .filter(AllocationGroup.name == update_data["name"], AllocationGroup.id != group_id)
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=409, detail=f"Allocation group '{update_data['name']}' already exists"
            )
    for key, val in update_data.items():
        setattr(group, key, val)
    db.commit()
    db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=204)
def delete_allocation_group(group_id: int, db: Session = Depends(get_db)):
    """Delete an allocation group (CASCADE removes assignments)."""
    group = db.get(AllocationGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Allocation group not found")
    db.delete(group)
    db.commit()


@router.post("/{group_id}/assign", status_code=204)
def assign_allocations(
    group_id: int, body: AssignAllocations, db: Session = Depends(get_db)
):
    """Assign holdings to an allocation group with target percentages.

    Validates:
    - All holdings exist
    - No holding is already in another group (mutual exclusivity)
    - Target percentages sum to ~100%
    """
    # Verify group exists
    group = db.get(AllocationGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Allocation group not found")

    # Verify all holdings exist and check mutual exclusivity
    for member in body.members:
        if member.holding_type == "stock":
            holding = db.get(StockHolding, member.holding_id)
            if not holding:
                raise HTTPException(
                    status_code=404, detail=f"Stock holding {member.holding_id} not found"
                )
            # Check if already in another group
            existing = db.execute(
                select(stock_allocation_groups.c.allocation_group_id).where(
                    stock_allocation_groups.c.stock_holding_id == member.holding_id
                )
            ).fetchone()
            if existing and existing[0] != group_id:
                other_group = db.get(AllocationGroup, existing[0])
                raise HTTPException(
                    status_code=409,
                    detail=f"Stock holding '{holding.ticker}' is already in group '{other_group.name}'",
                )
        else:  # manual
            holding = db.get(ManualHolding, member.holding_id)
            if not holding:
                raise HTTPException(
                    status_code=404, detail=f"Manual holding {member.holding_id} not found"
                )
            # Check if already in another group
            existing = db.execute(
                select(manual_allocation_groups.c.allocation_group_id).where(
                    manual_allocation_groups.c.manual_holding_id == member.holding_id
                )
            ).fetchone()
            if existing and existing[0] != group_id:
                other_group = db.get(AllocationGroup, existing[0])
                raise HTTPException(
                    status_code=409,
                    detail=f"Manual holding '{holding.name}' is already in group '{other_group.name}'",
                )

    # Delete existing assignments for this group
    db.execute(
        delete(stock_allocation_groups).where(
            stock_allocation_groups.c.allocation_group_id == group_id
        )
    )
    db.execute(
        delete(manual_allocation_groups).where(
            manual_allocation_groups.c.allocation_group_id == group_id
        )
    )

    # Insert new assignments
    for member in body.members:
        if member.holding_type == "stock":
            db.execute(
                insert(stock_allocation_groups).values(
                    stock_holding_id=member.holding_id,
                    allocation_group_id=group_id,
                    target_percentage=member.target_percentage,
                )
            )
        else:  # manual
            db.execute(
                insert(manual_allocation_groups).values(
                    manual_holding_id=member.holding_id,
                    allocation_group_id=group_id,
                    target_percentage=member.target_percentage,
                )
            )

    db.commit()


@router.get("/{group_id}/members", response_model=list[AllocationMemberRead])
def get_group_members(group_id: int, db: Session = Depends(get_db)):
    """Get all holdings assigned to a group with their target percentages."""
    # Verify group exists
    group = db.get(AllocationGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Allocation group not found")

    members = []

    # Query stock members
    stock_rows = db.execute(
        select(
            stock_allocation_groups.c.stock_holding_id,
            stock_allocation_groups.c.target_percentage,
        ).where(stock_allocation_groups.c.allocation_group_id == group_id)
    ).fetchall()

    for stock_id, target_pct in stock_rows:
        stock = db.get(StockHolding, stock_id)
        if stock:
            members.append(
                AllocationMemberRead(
                    holding_type="stock",
                    holding_id=stock.id,
                    holding_name=stock.display_name or stock.ticker,
                    target_percentage=target_pct,
                )
            )

    # Query manual members
    manual_rows = db.execute(
        select(
            manual_allocation_groups.c.manual_holding_id,
            manual_allocation_groups.c.target_percentage,
        ).where(manual_allocation_groups.c.allocation_group_id == group_id)
    ).fetchall()

    for manual_id, target_pct in manual_rows:
        manual = db.get(ManualHolding, manual_id)
        if manual:
            members.append(
                AllocationMemberRead(
                    holding_type="manual",
                    holding_id=manual.id,
                    holding_name=manual.name,
                    target_percentage=target_pct,
                )
            )

    return members


@router.get("/{group_id}/analysis", response_model=AllocationGroupAnalysis)
def get_group_analysis(
    group_id: int, display_currency: str = "RON", db: Session = Depends(get_db)
):
    """Get rebalancing analysis for a group (current vs target allocations)."""
    # Verify group exists
    group = db.get(AllocationGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Allocation group not found")

    try:
        return calculate_allocation_analysis(db, group_id, display_currency)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
