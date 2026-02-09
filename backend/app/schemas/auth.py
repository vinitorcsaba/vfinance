from pydantic import BaseModel


class GoogleLoginRequest(BaseModel):
    token: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    picture_url: str | None

    model_config = {"from_attributes": True}
