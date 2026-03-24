"""Attachment store — file I/O helpers for attachment files."""

from __future__ import annotations

from pathlib import Path

from .store import DATA_DIR

ATTACHMENTS_DIR = DATA_DIR / "attachments"


def ensure_dir() -> None:
    """Create attachments directory if missing."""
    ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)


def save_file(att_id: str, ext: str, data: bytes) -> Path:
    """Write attachment bytes to disk. Returns the file path."""
    ensure_dir()
    path = ATTACHMENTS_DIR / f"{att_id}{ext}"
    path.write_bytes(data)
    return path


def get_file_path(att_id: str, ext: str) -> Path:
    """Return the path where an attachment would be stored."""
    return ATTACHMENTS_DIR / f"{att_id}{ext}"


def delete_file(att_id: str, ext: str) -> None:
    """Delete a single attachment file from disk."""
    path = ATTACHMENTS_DIR / f"{att_id}{ext}"
    path.unlink(missing_ok=True)


def delete_all(attachments: list[dict]) -> None:
    """Delete all attachment files for a list of attachment metadata dicts."""
    for att in attachments:
        ext = Path(att["filename"]).suffix
        delete_file(att["id"], ext)
