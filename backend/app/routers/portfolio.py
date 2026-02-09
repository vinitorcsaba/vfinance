from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.schemas.portfolio import PortfolioResponse
from app.services.portfolio import build_portfolio

router = APIRouter(prefix="/api/v1", tags=["portfolio"], dependencies=[Depends(get_current_user)])


@router.get("/portfolio", response_model=PortfolioResponse)
def get_portfolio(db: Session = Depends(get_db)):
    """Return complete portfolio overview with live prices, currency totals, and grand total in RON."""
    return build_portfolio(db)
