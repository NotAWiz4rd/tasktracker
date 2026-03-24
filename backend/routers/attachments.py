from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from starlette.responses import FileResponse

from ..auth import get_current_user
from ..models import Attachment, HistoryEntry
from .. import store, kb_store, attachment_store

router = APIRouter(tags=["attachments"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _make_attachment(filename: str, content_type: str, size: int, user: str) -> Attachment:
    now = datetime.now(timezone.utc)
    return Attachment(
        id=f"att-{uuid.uuid4().hex[:8]}",
        filename=filename,
        content_type=content_type or "application/octet-stream",
        size_bytes=size,
        created_by=user,
        created_at=now,
    )


# --- Ticket attachments ---

@router.post("/api/tickets/{ticket_id}/attachments", status_code=status.HTTP_201_CREATED)
async def upload_ticket_attachment(
    ticket_id: str,
    file: UploadFile,
    user: Annotated[str, Depends(get_current_user)],
) -> Attachment:
    tickets = store.read_json(store.TICKETS_PATH)
    idx, data = _find_ticket(tickets, ticket_id)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    att = _make_attachment(file.filename or "upload", file.content_type or "", len(content), user)
    ext = Path(att.filename).suffix
    attachment_store.save_file(att.id, ext, content)

    data.setdefault("attachments", []).append(att.model_dump(mode="json"))
    now = datetime.now(timezone.utc)
    data["updated_at"] = now.isoformat()
    entry = HistoryEntry(at=now, by=user, change=f"attached {att.filename}")
    data.setdefault("history", []).append(entry.model_dump(mode="json"))
    tickets[idx] = data
    store.write_json(store.TICKETS_PATH, tickets)
    return att


@router.delete("/api/tickets/{ticket_id}/attachments/{att_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket_attachment(
    ticket_id: str,
    att_id: str,
    user: Annotated[str, Depends(get_current_user)],
) -> None:
    tickets = store.read_json(store.TICKETS_PATH)
    idx, data = _find_ticket(tickets, ticket_id)

    attachments = data.get("attachments", [])
    att = next((a for a in attachments if a["id"] == att_id), None)
    if not att:
        raise HTTPException(status_code=404, detail=f"Attachment {att_id} not found")

    ext = Path(att["filename"]).suffix
    attachment_store.delete_file(att_id, ext)

    data["attachments"] = [a for a in attachments if a["id"] != att_id]
    now = datetime.now(timezone.utc)
    data["updated_at"] = now.isoformat()
    entry = HistoryEntry(at=now, by=user, change=f"removed attachment {att['filename']}")
    data.setdefault("history", []).append(entry.model_dump(mode="json"))
    tickets[idx] = data
    store.write_json(store.TICKETS_PATH, tickets)


# --- KB article attachments ---

@router.post("/api/kb/{slug}/attachments", status_code=status.HTTP_201_CREATED)
async def upload_article_attachment(
    slug: str,
    file: UploadFile,
    user: Annotated[str, Depends(get_current_user)],
) -> Attachment:
    index = kb_store.read_index()
    idx, meta = _find_article(index, slug)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    att = _make_attachment(file.filename or "upload", file.content_type or "", len(content), user)
    ext = Path(att.filename).suffix
    attachment_store.save_file(att.id, ext, content)

    meta.setdefault("attachments", []).append(att.model_dump(mode="json"))
    now = datetime.now(timezone.utc)
    meta["updated_by"] = user
    meta["updated_at"] = now.isoformat()
    index[idx] = meta
    kb_store.write_index(index)
    return att


@router.delete("/api/kb/{slug}/attachments/{att_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article_attachment(
    slug: str,
    att_id: str,
    user: Annotated[str, Depends(get_current_user)],
) -> None:
    index = kb_store.read_index()
    idx, meta = _find_article(index, slug)

    attachments = meta.get("attachments", [])
    att = next((a for a in attachments if a["id"] == att_id), None)
    if not att:
        raise HTTPException(status_code=404, detail=f"Attachment {att_id} not found")

    ext = Path(att["filename"]).suffix
    attachment_store.delete_file(att_id, ext)

    meta["attachments"] = [a for a in attachments if a["id"] != att_id]
    now = datetime.now(timezone.utc)
    meta["updated_by"] = user
    meta["updated_at"] = now.isoformat()
    index[idx] = meta
    kb_store.write_index(index)


# --- Download ---

@router.get("/api/attachments/{att_id}/{filename}")
def download_attachment(
    att_id: str,
    filename: str,
    _user: Annotated[str, Depends(get_current_user)],
) -> FileResponse:
    ext = Path(filename).suffix
    path = attachment_store.get_file_path(att_id, ext)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Attachment file not found")
    return FileResponse(path, filename=filename)


# --- Helpers ---

def _find_ticket(tickets: list[dict], ticket_id: str) -> tuple[int, dict]:
    for i, t in enumerate(tickets):
        if t["id"] == ticket_id:
            return i, t
    raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")


def _find_article(index: list[dict], slug: str) -> tuple[int, dict]:
    for i, a in enumerate(index):
        if a["slug"] == slug:
            return i, a
    raise HTTPException(status_code=404, detail=f"Article {slug!r} not found")
