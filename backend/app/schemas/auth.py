from pydantic import BaseModel


class GoogleLoginRequest(BaseModel):
    token: str


class SheetsConnectRequest(BaseModel):
    code: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    picture_url: str | None
    sheets_connected: bool = False
    encryption_enabled: bool = False

    model_config = {"from_attributes": True}
