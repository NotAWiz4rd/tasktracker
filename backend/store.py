from __future__ import annotations

import json
import shutil
import time
from datetime import datetime, timezone, timedelta
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


ARCHIVE_AFTER_DAYS = 30


def auto_archive_done_tickets() -> None:
    """Archive tickets in 'done' status that haven't been updated in ARCHIVE_AFTER_DAYS days."""
    tickets = read_json(TICKETS_PATH)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=ARCHIVE_AFTER_DAYS)
    changed = False
    for t in tickets:
        if t.get("status") == "done" and not t.get("archived"):
            updated = t.get("updated_at", "")
            if isinstance(updated, str) and updated:
                try:
                    updated_dt = datetime.fromisoformat(updated)
                    if updated_dt.tzinfo is None:
                        updated_dt = updated_dt.replace(tzinfo=timezone.utc)
                except (ValueError, TypeError):
                    continue
                if updated_dt < cutoff:
                    t["archived"] = True
                    t["archived_at"] = now.isoformat()
                    t.setdefault("history", []).append({
                        "at": now.isoformat(),
                        "by": "system",
                        "change": "auto-archived (done for 30+ days)",
                    })
                    changed = True
    if changed:
        write_json(TICKETS_PATH, tickets)
