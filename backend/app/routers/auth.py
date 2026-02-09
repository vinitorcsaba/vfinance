from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import GoogleLoginRequest, UserResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _create_session_token(user_id: int) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(tz=timezone.utc) + timedelta(minutes=settings.auth_token_expire_minutes),
    }
    return jwt.encode(payload, settings.auth_secret_key, algorithm="HS256")


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        secure=False,  # Set True in production behind HTTPS
        samesite="lax",
        max_age=settings.auth_token_expire_minutes * 60,
        path="/",
    )


@router.post("/google", response_model=UserResponse)
def google_login(body: GoogleLoginRequest, response: Response, db: Session = Depends(get_db)):
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured")

    try:
        idinfo = id_token.verify_oauth2_token(
            body.token,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    email = idinfo.get("email", "")
    if not idinfo.get("email_verified"):
        raise HTTPException(status_code=401, detail="Email not verified by Google")

    # Check allowlist
    if settings.allowed_emails:
        allowed = [e.strip().lower() for e in settings.allowed_emails.split(",") if e.strip()]
        if email.lower() not in allowed:
            raise HTTPException(status_code=403, detail="Email not in allowlist")

    # Upsert user
    google_id = idinfo["sub"]
    user = db.query(User).filter(User.google_id == google_id).first()
    if user:
        user.email = email
        user.name = idinfo.get("name", "")
        user.picture_url = idinfo.get("picture")
        user.last_login = datetime.now(tz=timezone.utc)
    else:
        user = User(
            google_id=google_id,
            email=email,
            name=idinfo.get("name", ""),
            picture_url=idinfo.get("picture"),
        )
        db.add(user)
    db.commit()
    db.refresh(user)

    token = _create_session_token(user.id)
    _set_session_cookie(response, token)
    return user


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="session", path="/")
    return {"message": "Logged out"}
