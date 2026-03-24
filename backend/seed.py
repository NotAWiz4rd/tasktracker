"""Create initial data files if they don't exist."""

from __future__ import annotations

from . import store
from . import kb_store

SEED_COLUMNS = {
    "columns": [
        {"id": "backlog", "name": "Backlog", "order": 0},
        {"id": "in-progress", "name": "In Progress", "order": 1},
        {"id": "review", "name": "Review", "order": 2},
        {"id": "done", "name": "Done", "order": 3},
    ]
}

SEED_CONFIG = {
    "users": [
        {"id": "mike", "name": "Mike", "password": "1234", "avatar_color": "#4F46E5"},
        {"id": "user2", "name": "User 2", "password": "1234", "avatar_color": "#059669"},
        {"id": "user3", "name": "User 3", "password": "1234", "avatar_color": "#D97706"},
    ],
    "priorities": ["low", "medium", "high", "urgent"],
    "labels": ["backend", "frontend", "bug", "feature", "infra"],
    "next_ticket_number": 1,
}

SEED_TICKETS: list[dict] = []


def seed_data() -> None:
    store.DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not store.TICKETS_PATH.exists():
        store.write_json(store.TICKETS_PATH, SEED_TICKETS)

    if not store.COLUMNS_PATH.exists():
        store.write_json(store.COLUMNS_PATH, SEED_COLUMNS)

    if not store.CONFIG_PATH.exists():
        store.write_json(store.CONFIG_PATH, SEED_CONFIG)

    kb_store.ensure_kb_dirs()
