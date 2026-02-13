from datetime import datetime, timedelta, timezone

import jwt
import requests
from fastapi import APIRouter, Depends, HTTPException, Response
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_user_session, init_user_db
from app.dependencies.auth import get_current_user, get_user_db
from app.models.user import User
from app.schemas.auth import GoogleLoginRequest, SheetsConnectRequest, UserResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _create_session_token(email: str) -> str:
    """Create JWT session token with email as subject."""
    payload = {
        "sub": email,  # Store email instead of user ID
        "exp": datetime.now(tz=timezone.utc) + timedelta(minutes=settings.auth_token_expire_minutes),
    }
    return jwt.encode(payload, settings.auth_secret_key, algorithm="HS256")


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        max_age=settings.auth_token_expire_minutes * 60,
        path="/",
    )


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        picture_url=user.picture_url,
        sheets_connected=user.google_refresh_token is not None,
    )


@router.post("/google", response_model=UserResponse)
def google_login(body: GoogleLoginRequest, response: Response):
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

    # Initialize user's database (creates tables if first login)
    init_user_db(email)

    # Open user's database
    db = get_user_session(email)
    try:
        # Upsert user in their personal database
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

        # Create session token with email
        token = _create_session_token(email)
        _set_session_cookie(response, token)
        return _user_response(user)
    finally:
        db.close()


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return _user_response(user)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="session", path="/")
    return {"message": "Logged out"}


@router.post("/connect-sheets", response_model=UserResponse)
def connect_sheets(
    body: SheetsConnectRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_user_db),
):
    """Exchange Google auth code for tokens and store on user."""
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=500, detail="Google OAuth not fully configured")

    token_resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": body.code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": "postmessage",
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    if token_resp.status_code != 200:
        detail = token_resp.json().get("error_description", "Token exchange failed")
        raise HTTPException(status_code=400, detail=detail)

    tokens = token_resp.json()
    user.google_access_token = tokens["access_token"]
    if "refresh_token" in tokens:
        user.google_refresh_token = tokens["refresh_token"]
    db.commit()
    db.refresh(user)
    return _user_response(user)


@router.post("/disconnect-sheets", response_model=UserResponse)
def disconnect_sheets(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_user_db),
):
    """Clear Google Sheets tokens and spreadsheet ID."""
    user.google_access_token = None
    user.google_refresh_token = None
    user.sheets_spreadsheet_id = None
    db.commit()
    db.refresh(user)
    return _user_response(user)
