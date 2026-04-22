import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user, get_user_db
from app.models.saved_label_filter import SavedLabelFilter
from app.schemas.label_filter import (
    SavedLabelFilterCreate,
    SavedLabelFilterResponse,
    SavedLabelFilterUpdate,
)

router = APIRouter(
    prefix="/api/v1/label-filters",
    tags=["label-filters"],
    dependencies=[Depends(get_current_user)],
)


def _to_response(f: SavedLabelFilter) -> SavedLabelFilterResponse:
    return SavedLabelFilterResponse(
        id=f.id,
        name=f.name,
        label_ids=json.loads(f.label_ids),
        filter_mode=f.filter_mode,
        chart_mode=f.chart_mode,
        created_at=f.created_at,
    )


@router.get("", response_model=list[SavedLabelFilterResponse])
def list_saved_filters(db: Session = Depends(get_user_db)):
    filters = db.query(SavedLabelFilter).order_by(SavedLabelFilter.created_at).all()
    return [_to_response(f) for f in filters]


@router.post("", response_model=SavedLabelFilterResponse, status_code=201)
def create_saved_filter(body: SavedLabelFilterCreate, db: Session = Depends(get_user_db)):
    f = SavedLabelFilter(
        name=body.name,
        label_ids=json.dumps(body.label_ids),
        filter_mode=body.filter_mode,
        chart_mode=body.chart_mode,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return _to_response(f)


@router.patch("/{filter_id}", response_model=SavedLabelFilterResponse)
def rename_saved_filter(
    filter_id: int, body: SavedLabelFilterUpdate, db: Session = Depends(get_user_db)
):
    f = db.get(SavedLabelFilter, filter_id)
    if not f:
        raise HTTPException(status_code=404, detail="Saved filter not found")
    f.name = body.name
    db.commit()
    db.refresh(f)
    return _to_response(f)


@router.delete("/{filter_id}", status_code=204)
def delete_saved_filter(filter_id: int, db: Session = Depends(get_user_db)):
    f = db.get(SavedLabelFilter, filter_id)
    if not f:
        raise HTTPException(status_code=404, detail="Saved filter not found")
    db.delete(f)
    db.commit()
