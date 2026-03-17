from __future__ import annotations

from fastapi import APIRouter

from ..models import ConfigFile, ConfigPublic, UserPublic
from .. import store

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("")
def get_config() -> ConfigPublic:
    config = ConfigFile(**store.read_json(store.CONFIG_PATH))
    return ConfigPublic(
        users=[UserPublic(id=u.id, name=u.name, avatar_color=u.avatar_color) for u in config.users],
        priorities=config.priorities,
        labels=config.labels,
    )
