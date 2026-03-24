from contextlib import asynccontextmanager
from typing import Annotated, AsyncGenerator

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .auth import get_current_user, login
from .models import ConfigFile, LoginRequest, LoginResponse, UserPublic, UserPreferencesUpdate
from .routers import attachments, columns, config, kb, tickets
from .seed import seed_data
from . import store


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    seed_data()
    yield


app = FastAPI(title="TaskTracker", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tickets.router)
app.include_router(columns.router)
app.include_router(config.router)
app.include_router(kb.router)
app.include_router(attachments.router)


@app.post("/api/login", tags=["auth"])
def api_login(body: LoginRequest) -> LoginResponse:
    return login(body)


@app.get("/api/me", tags=["auth"])
def api_me(user_id: Annotated[str, Depends(get_current_user)]) -> UserPublic:
    cfg = ConfigFile(**store.read_json(store.CONFIG_PATH))
    for u in cfg.users:
        if u.id == user_id:
            return UserPublic(id=u.id, name=u.name, avatar_color=u.avatar_color, preferences=u.preferences)
    return UserPublic(id=user_id, name=user_id, avatar_color="#6B7280")


@app.patch("/api/me/preferences", tags=["auth"])
def api_update_preferences(body: UserPreferencesUpdate, user_id: Annotated[str, Depends(get_current_user)]) -> UserPublic:
    data = store.read_json(store.CONFIG_PATH)
    cfg = ConfigFile(**data)
    for u in cfg.users:
        if u.id == user_id:
            if body.dark_mode is not None:
                u.preferences.dark_mode = body.dark_mode
            if body.split_view is not None:
                u.preferences.split_view = body.split_view
            store.write_json(store.CONFIG_PATH, cfg.model_dump(mode="json"))
            return UserPublic(id=u.id, name=u.name, avatar_color=u.avatar_color, preferences=u.preferences)
    raise HTTPException(status_code=404, detail="User not found")
