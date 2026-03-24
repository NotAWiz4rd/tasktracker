from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..auth import get_current_user
from ..models import (
    Comment,
    CommentCreate,
    HistoryEntry,
    Ticket,
    TicketCreate,
    TicketMove,
    TicketReorder,
    TicketUpdate,
)
from .. import attachment_store, store

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


def _find_ticket(tickets: list[dict], ticket_id: str) -> tuple[int, dict]:
    for i, t in enumerate(tickets):
        if t["id"] == ticket_id:
            return i, t
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ticket {ticket_id} not found")


def _valid_status(status_id: str) -> str:
    """Validate and return the normalized (lowercase) status id."""
    normalized = status_id.lower()
    columns = store.read_json(store.COLUMNS_PATH)
    valid = {c["id"] for c in columns["columns"]}
    if normalized not in valid:
        raise HTTPException(status_code=422, detail=f"Invalid status: {status_id}")
    return normalized


def _describe_update(old: dict, updates: dict) -> str:
    parts = []
    for key, new_val in updates.items():
        old_val = old.get(key)
        if old_val != new_val:
            if key == "title":
                parts.append("title updated")
            elif key == "description":
                parts.append("description updated")
            else:
                parts.append(f"{key}: {old_val} → {new_val}")
    return "; ".join(parts) if parts else "updated"


@router.get("")
def list_tickets(
    _user: Annotated[str, Depends(get_current_user)],
    status: str | None = Query(None),
    assignee: str | None = Query(None),
    priority: str | None = Query(None),
    label: str | None = Query(None),
    search: str | None = Query(None),
    include_archived: bool = Query(False),
) -> list[Ticket]:
    store.auto_archive_done_tickets()
    tickets = store.read_json(store.TICKETS_PATH)
    if not include_archived:
        tickets = [t for t in tickets if not t.get("archived")]
    if status:
        status_lower = status.lower()
        tickets = [t for t in tickets if t["status"].lower() == status_lower]
    if assignee:
        tickets = [t for t in tickets if t.get("assignee") == assignee]
    if priority:
        tickets = [t for t in tickets if t["priority"] == priority]
    if label:
        tickets = [t for t in tickets if label in t.get("labels", [])]
    if search:
        q = search.lower()
        tickets = [
            t for t in tickets
            if q in t["title"].lower() or q in t.get("description", "").lower()
        ]
    return [Ticket(**t) for t in tickets]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_ticket(
    body: TicketCreate,
    user: Annotated[str, Depends(get_current_user)],
) -> Ticket:
    normalized_status = _valid_status(body.status)
    now = datetime.now(timezone.utc)
    ticket = Ticket(
        id=store.next_ticket_id(),
        title=body.title,
        description=body.description,
        status=normalized_status,
        assignee=body.assignee,
        priority=body.priority,
        labels=body.labels,
        created_by=user,
        created_at=now,
        updated_at=now,
        history=[HistoryEntry(at=now, by=user, change="created")],
    )
    tickets = store.read_json(store.TICKETS_PATH)
    tickets.append(ticket.model_dump(mode="json"))
    store.write_json(store.TICKETS_PATH, tickets)
    return ticket


@router.get("/{ticket_id}")
def get_ticket(
    ticket_id: str,
    _user: Annotated[str, Depends(get_current_user)],
) -> Ticket:
    tickets = store.read_json(store.TICKETS_PATH)
    _, data = _find_ticket(tickets, ticket_id)
    return Ticket(**data)


@router.patch("/{ticket_id}")
def update_ticket(
    ticket_id: str,
    body: TicketUpdate,
    user: Annotated[str, Depends(get_current_user)],
) -> Ticket:
    tickets = store.read_json(store.TICKETS_PATH)
    idx, data = _find_ticket(tickets, ticket_id)
    updates = body.model_dump(exclude_none=True)
    change_desc = _describe_update(data, updates)
    data.update(updates)
    now = datetime.now(timezone.utc)
    data["updated_at"] = now.isoformat()
    entry = HistoryEntry(at=now, by=user, change=change_desc)
    data.setdefault("history", []).append(entry.model_dump(mode="json"))
    tickets[idx] = data
    store.write_json(store.TICKETS_PATH, tickets)
    return Ticket(**data)


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(
    ticket_id: str,
    _user: Annotated[str, Depends(get_current_user)],
) -> None:
    tickets = store.read_json(store.TICKETS_PATH)
    idx, data = _find_ticket(tickets, ticket_id)
    attachment_store.delete_all(data.get("attachments", []))
    tickets.pop(idx)
    store.write_json(store.TICKETS_PATH, tickets)


@router.post("/{ticket_id}/comments", status_code=status.HTTP_201_CREATED)
def add_comment(
    ticket_id: str,
    body: CommentCreate,
    user: Annotated[str, Depends(get_current_user)],
) -> Comment:
    tickets = store.read_json(store.TICKETS_PATH)
    idx, data = _find_ticket(tickets, ticket_id)
    now = datetime.now(timezone.utc)
    comment = Comment(
        id=f"c-{uuid.uuid4().hex[:8]}",
        author=user,
        body=body.body,
        created_at=now,
    )
    data.setdefault("comments", []).append(comment.model_dump(mode="json"))
    entry = HistoryEntry(at=now, by=user, change="commented")
    data.setdefault("history", []).append(entry.model_dump(mode="json"))
    data["updated_at"] = now.isoformat()
    tickets[idx] = data
    store.write_json(store.TICKETS_PATH, tickets)
    return comment


@router.post("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_tickets(
    body: TicketReorder,
    _user: Annotated[str, Depends(get_current_user)],
) -> None:
    normalized_status = _valid_status(body.status)
    tickets = store.read_json(store.TICKETS_PATH)
    id_to_ticket = {t["id"]: t for t in tickets}
    reordered = [id_to_ticket[i] for i in body.ids if i in id_to_ticket and id_to_ticket[i].get("status") == normalized_status]
    others = [t for t in tickets if t.get("status") != normalized_status]
    store.write_json(store.TICKETS_PATH, reordered + others)


@router.patch("/{ticket_id}/move")
def move_ticket(
    ticket_id: str,
    body: TicketMove,
    user: Annotated[str, Depends(get_current_user)],
) -> Ticket:
    normalized_status = _valid_status(body.status)
    tickets = store.read_json(store.TICKETS_PATH)
    idx, data = _find_ticket(tickets, ticket_id)
    old_status = data.get("status", "")
    now = datetime.now(timezone.utc)
    entry = HistoryEntry(at=now, by=user, change=f"status: {old_status} → {normalized_status}")
    data["status"] = normalized_status
    data["updated_at"] = now.isoformat()
    # Unarchive if moving out of done
    if normalized_status != "done" and data.get("archived"):
        data["archived"] = False
        data["archived_at"] = None
        data.setdefault("history", []).append(
            HistoryEntry(at=now, by=user, change="unarchived").model_dump(mode="json")
        )
    data.setdefault("history", []).append(entry.model_dump(mode="json"))
    tickets[idx] = data
    store.write_json(store.TICKETS_PATH, tickets)
    return Ticket(**data)


@router.patch("/{ticket_id}/unarchive")
def unarchive_ticket(
    ticket_id: str,
    user: Annotated[str, Depends(get_current_user)],
) -> Ticket:
    tickets = store.read_json(store.TICKETS_PATH)
    idx, data = _find_ticket(tickets, ticket_id)
    if not data.get("archived"):
        raise HTTPException(status_code=422, detail="Ticket is not archived")
    now = datetime.now(timezone.utc)
    data["archived"] = False
    data["archived_at"] = None
    data["updated_at"] = now.isoformat()
    entry = HistoryEntry(at=now, by=user, change="unarchived")
    data.setdefault("history", []).append(entry.model_dump(mode="json"))
    tickets[idx] = data
    store.write_json(store.TICKETS_PATH, tickets)
    return Ticket(**data)
