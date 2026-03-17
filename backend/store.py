from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from filelock import FileLock

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

TICKETS_PATH = DATA_DIR / "tickets.json"
COLUMNS_PATH = DATA_DIR / "columns.json"
CONFIG_PATH = DATA_DIR / "config.json"


def _lock_path(path: Path) -> Path:
    return path.with_suffix(path.suffix + ".lock")


def read_json(path: Path) -> Any:
    lock = FileLock(_lock_path(path))
    with lock:
        return json.loads(path.read_text())


def write_json(path: Path, data: Any) -> None:
    lock = FileLock(_lock_path(path))
    with lock:
        path.write_text(json.dumps(data, indent=2, default=str) + "\n")


def next_ticket_id() -> str:
    config = read_json(CONFIG_PATH)
    num = config["next_ticket_number"]
    config["next_ticket_number"] = num + 1
    write_json(CONFIG_PATH, config)
    return f"TT-{num}"
