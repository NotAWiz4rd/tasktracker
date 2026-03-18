from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .models import ConfigFile, LoginRequest, LoginResponse, UserPublic
from . import store

JWT_SECRET = "tasktracker-dev-secret-key-min32"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72

security = HTTPBearer()


def authenticate_user(req: LoginRequest) -> UserPublic:
    config = ConfigFile(**store.read_json(store.CONFIG_PATH))
    for user in config.users:
        if user.id == req.username and user.password == req.password:
            return UserPublic(id=user.id, name=user.name, avatar_color=user.avatar_color)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def login(req: LoginRequest) -> LoginResponse:
    user = authenticate_user(req)
    token = create_token(user.id)
    return LoginResponse(token=token, user=user)


_SHARE_TOKEN_LENGTH = 24


def generate_share_token(slug: str) -> str:
    """Return a deterministic, unforgeable share token for the given article slug."""
    mac = hmac.new(JWT_SECRET.encode(), slug.encode(), hashlib.sha256)
    return mac.hexdigest()[:_SHARE_TOKEN_LENGTH]


def verify_share_token(slug: str, token: str) -> bool:
    """Return True if token is the valid share token for slug (constant-time compare)."""
    expected = generate_share_token(slug)
    return hmac.compare_digest(expected, token)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> str:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload["sub"]
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
