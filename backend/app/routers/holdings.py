from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.holding import ManualHolding, StockHolding
from app.services.price import lookup_ticker, normalize_ticker
from app.schemas.holding import (
    ManualHoldingCreate,
    ManualHoldingRead,
    ManualHoldingUpdate,
    StockHoldingCreate,
    StockHoldingRead,
    StockHoldingUpdate,
)

router = APIRouter(prefix="/api/v1/holdings", tags=["holdings"])


# --- Stock Holdings ---


@router.get("/stocks", response_model=list[StockHoldingRead])
def list_stocks(db: Session = Depends(get_db)):
    return db.query(StockHolding).order_by(StockHolding.ticker).all()


@router.post("/stocks", response_model=StockHoldingRead, status_code=201)
def create_stock(body: StockHoldingCreate, db: Session = Depends(get_db)):
    normalized = normalize_ticker(body.ticker)
    existing = db.query(StockHolding).filter(StockHolding.ticker == normalized).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Stock with ticker '{normalized}' already exists")
    # Auto-populate currency from yfinance
    currency = None
    try:
        price_info = lookup_ticker(normalized)
        currency = price_info.currency
    except ValueError:
        pass  # ticker not found — leave currency as None

    stock = StockHolding(
        ticker=normalized,
        shares=body.shares,
        currency=currency,
        display_name=body.display_name,
    )
    db.add(stock)
    db.commit()
    db.refresh(stock)
    return stock


@router.put("/stocks/{stock_id}", response_model=StockHoldingRead)
def update_stock(stock_id: int, body: StockHoldingUpdate, db: Session = Depends(get_db)):
    stock = db.get(StockHolding, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock holding not found")
    update_data = body.model_dump(exclude_unset=True)
    if "ticker" in update_data:
        update_data["ticker"] = normalize_ticker(update_data["ticker"])
        # Re-fetch currency for the new ticker
        try:
            price_info = lookup_ticker(update_data["ticker"])
            update_data["currency"] = price_info.currency
        except ValueError:
            update_data["currency"] = None
    for key, val in update_data.items():
        setattr(stock, key, val)
    db.commit()
    db.refresh(stock)
    return stock


@router.delete("/stocks/{stock_id}", status_code=204)
def delete_stock(stock_id: int, db: Session = Depends(get_db)):
    stock = db.get(StockHolding, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock holding not found")
    db.delete(stock)
    db.commit()


# --- Manual Holdings ---


@router.get("/manual", response_model=list[ManualHoldingRead])
def list_manual(db: Session = Depends(get_db)):
    return db.query(ManualHolding).order_by(ManualHolding.name).all()


@router.post("/manual", response_model=ManualHoldingRead, status_code=201)
def create_manual(body: ManualHoldingCreate, db: Session = Depends(get_db)):
    holding = ManualHolding(
        name=body.name,
        value=body.value,
        currency=body.currency.value,
    )
    db.add(holding)
    db.commit()
    db.refresh(holding)
    return holding


@router.put("/manual/{holding_id}", response_model=ManualHoldingRead)
def update_manual(holding_id: int, body: ManualHoldingUpdate, db: Session = Depends(get_db)):
    holding = db.get(ManualHolding, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Manual holding not found")
    update_data = body.model_dump(exclude_unset=True)
    if "currency" in update_data:
        update_data["currency"] = update_data["currency"].value
    for key, val in update_data.items():
        setattr(holding, key, val)
    db.commit()
    db.refresh(holding)
    return holding


@router.delete("/manual/{holding_id}", status_code=204)
def delete_manual(holding_id: int, db: Session = Depends(get_db)):
    holding = db.get(ManualHolding, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Manual holding not found")
    db.delete(holding)
    db.commit()
