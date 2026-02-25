import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.auth import get_user_db
from app.dependencies.auth import get_current_user
from app.models.holding import ManualHolding, StockHolding
from app.models.transaction import Transaction
from app.services.portfolio import _fetch_fx_rates
from app.services.price import fetch_historical_fx_rates, fetch_historical_price, lookup_ticker, normalize_ticker
from app.schemas.holding import (
    ManualAddValue,
    ManualHoldingCreate,
    ManualHoldingRead,
    ManualHoldingUpdate,
    StockAddShares,
    StockHoldingCreate,
    StockHoldingRead,
    StockHoldingUpdate,
)
from app.schemas.transaction import TransactionCreate, TransactionRead, TransactionUpdate

router = APIRouter(prefix="/api/v1/holdings", tags=["holdings"], dependencies=[Depends(get_current_user)])


# --- Stock Holdings ---


@router.get("/stocks", response_model=list[StockHoldingRead])
def list_stocks(db: Session = Depends(get_user_db)):
    return db.query(StockHolding).order_by(StockHolding.ticker).all()


@router.post("/stocks", response_model=StockHoldingRead, status_code=201)
def create_stock(body: StockHoldingCreate, db: Session = Depends(get_user_db)):
    normalized = normalize_ticker(body.ticker)
    existing = db.query(StockHolding).filter(StockHolding.ticker == normalized).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Stock with ticker '{normalized}' already exists")

    # Resolve currency and capture live price for the initial transaction
    live_price: float | None = None
    if body.currency is not None:
        currency = body.currency.value
    else:
        currency = None
        try:
            price_info = lookup_ticker(normalized)
            currency = price_info.currency
            live_price = price_info.price
        except ValueError:
            pass

    stock = StockHolding(
        ticker=normalized,
        shares=body.shares,
        currency=currency,
        display_name=body.display_name,
    )
    db.add(stock)
    db.commit()
    db.refresh(stock)

    # --- Auto-create initial transaction ---
    txn_date = body.transaction_date or dt.date.today()
    txn_price = body.transaction_price

    if txn_price is None:
        # Try historical price first (if user specified a past date); otherwise use live price
        if body.transaction_date is not None and body.transaction_date < dt.date.today():
            txn_price = fetch_historical_price(normalized, txn_date)
        if txn_price is None:
            # Fall back to live price already fetched (or fetch now if we skipped above)
            if live_price is None:
                try:
                    live_price = lookup_ticker(normalized).price
                except ValueError:
                    pass
            txn_price = live_price

    if txn_price is not None:
        # Use historical FX rates for the transaction date
        if txn_date < dt.date.today():
            fx = fetch_historical_fx_rates(txn_date)
        else:
            fx = _fetch_fx_rates()
        stock_currency = currency or "RON"
        rate = fx.get(stock_currency, 1.0)
        value_native = body.shares * txn_price
        value_ron = round(value_native * rate, 2)

        transaction = Transaction(
            holding_id=stock.id,
            date=txn_date,
            shares=body.shares,
            price_per_share=txn_price,
            value_ron=value_ron,
            value_eur=round(value_ron / fx.get("EUR", 5.0), 2),
            value_usd=round(value_ron / fx.get("USD", 4.5), 2),
        )
        db.add(transaction)
        db.commit()

    return stock


@router.put("/stocks/{stock_id}", response_model=StockHoldingRead)
def update_stock(stock_id: int, body: StockHoldingUpdate, db: Session = Depends(get_user_db)):
    stock = db.get(StockHolding, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock holding not found")
    update_data = body.model_dump(exclude_unset=True)
    if "currency" in update_data and update_data["currency"] is not None:
        update_data["currency"] = update_data["currency"].value
    if "ticker" in update_data:
        update_data["ticker"] = normalize_ticker(update_data["ticker"])
        # Only re-fetch currency if no explicit override was provided
        if "currency" not in update_data:
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


@router.post("/stocks/{stock_id}/add-shares", response_model=StockHoldingRead)
def add_stock_shares(stock_id: int, body: StockAddShares, db: Session = Depends(get_user_db)):
    stock = db.get(StockHolding, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock holding not found")
    stock.shares += body.shares
    db.commit()
    db.refresh(stock)
    return stock


@router.delete("/stocks/{stock_id}", status_code=204)
def delete_stock(stock_id: int, db: Session = Depends(get_user_db)):
    stock = db.get(StockHolding, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock holding not found")
    db.delete(stock)
    db.commit()


# --- Stock Transactions ---


@router.post("/stocks/{stock_id}/transactions", response_model=TransactionRead, status_code=201)
def create_transaction(stock_id: int, body: TransactionCreate, db: Session = Depends(get_user_db)):
    """Create a transaction record for a stock holding."""
    stock = db.get(StockHolding, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock holding not found")

    txn_date = body.date
    if txn_date < dt.date.today():
        fx = fetch_historical_fx_rates(txn_date)
    else:
        fx = _fetch_fx_rates()
    currency = stock.currency or "RON"
    rate = fx.get(currency, 1.0)
    value_native = body.shares * body.price_per_share  # signed: positive=buy, negative=sell
    value_ron = round(value_native * rate, 2)

    transaction = Transaction(
        holding_id=stock_id,
        date=body.date,
        shares=body.shares,
        price_per_share=body.price_per_share,
        notes=body.notes,
        value_ron=value_ron,
        value_eur=round(value_ron / fx.get("EUR", 5.0), 2),
        value_usd=round(value_ron / fx.get("USD", 4.5), 2),
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


@router.get("/stocks/{stock_id}/transactions", response_model=list[TransactionRead])
def list_transactions(stock_id: int, db: Session = Depends(get_user_db)):
    """List all transactions for a stock holding, ordered by date descending."""
    stock = db.get(StockHolding, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock holding not found")

    return db.query(Transaction).filter(Transaction.holding_id == stock_id).order_by(Transaction.date.desc()).all()


@router.delete("/transactions/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_user_db)):
    """Delete a transaction record."""
    transaction = db.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    db.delete(transaction)
    db.commit()


@router.put("/transactions/{transaction_id}", response_model=TransactionRead)
def update_transaction(transaction_id: int, body: TransactionUpdate, db: Session = Depends(get_user_db)):
    """Update a transaction's date, price per share, or notes.

    When the date or price changes, value_ron/eur/usd are recalculated using
    FX rates at the (new) transaction date for accuracy.
    """
    transaction = db.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    stock = db.get(StockHolding, transaction.holding_id)

    if body.date is not None:
        transaction.date = body.date
    if body.price_per_share is not None:
        transaction.price_per_share = body.price_per_share
    if body.notes is not None:
        transaction.notes = body.notes

    # Recalculate multi-currency values whenever date or price changed
    if body.date is not None or body.price_per_share is not None:
        txn_date = transaction.date
        if txn_date < dt.date.today():
            fx = fetch_historical_fx_rates(txn_date)
        else:
            fx = _fetch_fx_rates()
        stock_currency = (stock.currency if stock else None) or "RON"
        rate = fx.get(stock_currency, 1.0)
        value_native = transaction.shares * transaction.price_per_share
        value_ron = round(value_native * rate, 2)
        transaction.value_ron = value_ron
        transaction.value_eur = round(value_ron / fx.get("EUR", 5.0), 2)
        transaction.value_usd = round(value_ron / fx.get("USD", 4.5), 2)

    db.commit()
    db.refresh(transaction)
    return transaction


# --- Manual Holdings ---


@router.get("/manual", response_model=list[ManualHoldingRead])
def list_manual(db: Session = Depends(get_user_db)):
    return db.query(ManualHolding).order_by(ManualHolding.name).all()


@router.post("/manual", response_model=ManualHoldingRead, status_code=201)
def create_manual(body: ManualHoldingCreate, db: Session = Depends(get_user_db)):
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
def update_manual(holding_id: int, body: ManualHoldingUpdate, db: Session = Depends(get_user_db)):
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
def delete_manual(holding_id: int, db: Session = Depends(get_user_db)):
    holding = db.get(ManualHolding, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Manual holding not found")
    db.delete(holding)
    db.commit()


@router.post("/manual/{holding_id}/add-value", response_model=ManualHoldingRead)
def add_manual_value(holding_id: int, body: ManualAddValue, db: Session = Depends(get_user_db)):
    holding = db.get(ManualHolding, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Manual holding not found")
    holding.value += body.value
    db.commit()
    db.refresh(holding)
    return holding
