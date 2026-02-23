import logging
from datetime import datetime, timezone

import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_user_session, init_user_db
from app.models.user import User

logger = logging.getLogger(__name__)


def get_user_email_from_token(request: Request) -> str:
    """
    Extract and validate user email from JWT session token.
    Returns the email which is used to determine which database to open.
    """
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, settings.auth_secret_key, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError as exc:
        logger.warning("JWT decode failed: %s (token length=%d)", exc, len(token))
        raise HTTPException(status_code=401, detail="Invalid session")

    email: str | None = payload.get("sub")
    if email is None or "@" not in email:
        raise HTTPException(status_code=401, detail="Invalid session")

    return email


def get_user_db(email: str = Depends(get_user_email_from_token)) -> Session:
    """
    Get database session for the authenticated user.
    Opens the user-specific database based on their email.
    Returns 423 Locked if the database is encrypted and not yet unlocked.
    """
    from app.database import read_user_meta, _db_keys

    meta = read_user_meta(email)
    if meta.get("encrypted") and email not in _db_keys:
        raise HTTPException(status_code=423, detail="Database locked")

    init_user_db(email)

    db = get_user_session(email)
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    request: Request,
    email: str = Depends(get_user_email_from_token),
    db: Session = Depends(get_user_db),
) -> User:
    """
    Get the current authenticated user from their personal database.
    Creates User record if it doesn't exist (first login).
    """
    user = db.query(User).filter(User.email == email).first()

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user
