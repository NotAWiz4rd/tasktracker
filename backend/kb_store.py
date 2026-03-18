"""Knowledge Base store — file-locked JSON + markdown I/O."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from filelock import FileLock

from .store import DATA_DIR

KB_DIR = DATA_DIR / "kb"
ARTICLES_DIR = KB_DIR / "articles"
KB_INDEX_PATH = KB_DIR / "kb_index.json"


def _lock_path(path: Path) -> Path:
    return path.with_suffix(path.suffix + ".lock")


def ensure_kb_dirs() -> None:
    """Create KB directories and empty index if missing."""
    KB_DIR.mkdir(parents=True, exist_ok=True)
    ARTICLES_DIR.mkdir(exist_ok=True)
    if not KB_INDEX_PATH.exists():
        write_index([])


def read_index() -> list[dict[str, Any]]:
    lock = FileLock(_lock_path(KB_INDEX_PATH))
    with lock:
        return json.loads(KB_INDEX_PATH.read_text())


def write_index(data: list[dict[str, Any]]) -> None:
    lock = FileLock(_lock_path(KB_INDEX_PATH))
    with lock:
        KB_INDEX_PATH.write_text(json.dumps(data, indent=2, default=str) + "\n")


def read_article_content(slug: str) -> str:
    path = ARTICLES_DIR / f"{slug}.md"
    if not path.exists():
        return ""
    return path.read_text()


def write_article_content(slug: str, content: str) -> None:
    path = ARTICLES_DIR / f"{slug}.md"
    path.write_text(content)


def delete_article_file(slug: str) -> None:
    path = ARTICLES_DIR / f"{slug}.md"
    path.unlink(missing_ok=True)


def slugify(title: str) -> str:
    """Convert a title to a URL-friendly slug."""
    s = title.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")
