from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.holding import ManualHolding, StockHolding
from app.models.label import Label
from app.schemas.label import AssignLabels, LabelCreate, LabelRead, LabelUpdate

router = APIRouter(prefix="/api/v1", tags=["labels"], dependencies=[Depends(get_current_user)])


@router.get("/labels", response_model=list[LabelRead])
def list_labels(db: Session = Depends(get_db)):
    return db.query(Label).order_by(Label.name).all()


@router.post("/labels", response_model=LabelRead, status_code=201)
def create_label(body: LabelCreate, db: Session = Depends(get_db)):
    existing = db.query(Label).filter(Label.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Label '{body.name}' already exists")
    label = Label(name=body.name, color=body.color)
    db.add(label)
    db.commit()
    db.refresh(label)
    return label


@router.put("/labels/{label_id}", response_model=LabelRead)
def update_label(label_id: int, body: LabelUpdate, db: Session = Depends(get_db)):
    label = db.get(Label, label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    update_data = body.model_dump(exclude_unset=True)
    if "name" in update_data:
        conflict = db.query(Label).filter(Label.name == update_data["name"], Label.id != label_id).first()
        if conflict:
            raise HTTPException(status_code=409, detail=f"Label '{update_data['name']}' already exists")
    for key, val in update_data.items():
        setattr(label, key, val)
    db.commit()
    db.refresh(label)
    return label


@router.delete("/labels/{label_id}", status_code=204)
def delete_label(label_id: int, db: Session = Depends(get_db)):
    label = db.get(Label, label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    db.delete(label)
    db.commit()


@router.post("/holdings/stocks/{stock_id}/labels", response_model=list[LabelRead])
def assign_stock_labels(stock_id: int, body: AssignLabels, db: Session = Depends(get_db)):
    stock = db.get(StockHolding, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock holding not found")
    labels = db.query(Label).filter(Label.id.in_(body.label_ids)).all()
    stock.labels = labels
    db.commit()
    db.refresh(stock)
    return stock.labels


@router.post("/holdings/manual/{holding_id}/labels", response_model=list[LabelRead])
def assign_manual_labels(holding_id: int, body: AssignLabels, db: Session = Depends(get_db)):
    holding = db.get(ManualHolding, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Manual holding not found")
    labels = db.query(Label).filter(Label.id.in_(body.label_ids)).all()
    holding.labels = labels
    db.commit()
    db.refresh(holding)
    return holding.labels
