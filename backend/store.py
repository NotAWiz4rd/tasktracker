from __future__ import annotations

import json
import shutil
import time
from pathlib import Path
from typing import Any

from filelock import FileLock

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

TICKETS_PATH = DATA_DIR / "tickets.json"
COLUMNS_PATH = DATA_DIR / "columns.json"
CONFIG_PATH = DATA_DIR / "config.json"
BACKUP_DIR = DATA_DIR / "backups"

_write_count = 0


def _lock_path(path: Path) -> Path:
    return path.with_suffix(path.suffix + ".lock")


def _do_backup() -> None:
    BACKUP_DIR.mkdir(exist_ok=True)
    timestamp = int(time.time())
    for src in (TICKETS_PATH, COLUMNS_PATH, CONFIG_PATH):
        if src.exists():
            dest = BACKUP_DIR / f"{src.stem}_{timestamp}.json"
            shutil.copy2(src, dest)
    # Keep only the last 20 backups per file stem
    for stem in ("tickets", "columns", "config"):
        backups = sorted(BACKUP_DIR.glob(f"{stem}_*.json"))
        for old in backups[:-20]:
            old.unlink(missing_ok=True)


def read_json(path: Path) -> Any:
    lock = FileLock(_lock_path(path))
    with lock:
        return json.loads(path.read_text())


def write_json(path: Path, data: Any) -> None:
    global _write_count
    lock = FileLock(_lock_path(path))
    with lock:
        path.write_text(json.dumps(data, indent=2, default=str) + "\n")
    _write_count += 1
    if _write_count % 10 == 0:
        _do_backup()


def next_ticket_id() -> str:
    config = read_json(CONFIG_PATH)
    num = config["next_ticket_number"]
    config["next_ticket_number"] = num + 1
    write_json(CONFIG_PATH, config)
    return f"TT-{num}"
