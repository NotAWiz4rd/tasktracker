from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..auth import get_current_user
from ..models import (
    Comment,
    CommentCreate,
    Ticket,
    TicketCreate,
    TicketMove,
    TicketUpdate,
)
from .. import store

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


def _find_ticket(tickets: list[dict], ticket_id: str) -> tuple[int, dict]:
    for i, t in enumerate(tickets):
        if t["id"] == ticket_id:
            return i, t
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ticket {ticket_id} not found")


def _valid_status(status_id: str) -> None:
    columns = store.read_json(store.COLUMNS_PATH)
    valid = {c["id"] for c in columns["columns"]}
    if status_id not in valid:
        raise HTTPException(status_code=422, detail=f"Invalid status: {status_id}")


@router.get("")
def list_tickets(
    _user: Annotated[str, Depends(get_current_user)],
    status: str | None = Query(None),
    assignee: str | None = Query(None),
    priority: str | None = Query(None),
    label: str | None = Query(None),
    search: str | None = Query(None),
) -> list[Ticket]:
    tickets = store.read_json(store.TICKETS_PATH)
    if status:
        tickets = [t for t in tickets if t["status"] == status]
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
    _valid_status(body.status)
    now = datetime.now(timezone.utc)
    ticket = Ticket(
        id=store.next_ticket_id(),
        title=body.title,
        description=body.description,
        status=body.status,
        assignee=body.assignee,
        priority=body.priority,
        labels=body.labels,
        created_by=user,
        created_at=now,
        updated_at=now,
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
    _user: Annotated[str, Depends(get_current_user)],
) -> Ticket:
    tickets = store.read_json(store.TICKETS_PATH)
    idx, data = _find_ticket(tickets, ticket_id)
    updates = body.model_dump(exclude_none=True)
    data.update(updates)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    tickets[idx] = data
    store.write_json(store.TICKETS_PATH, tickets)
    return Ticket(**data)


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(
    ticket_id: str,
    _user: Annotated[str, Depends(get_current_user)],
) -> None:
    tickets = store.read_json(store.TICKETS_PATH)
    idx, _ = _find_ticket(tickets, ticket_id)
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
    comment = Comment(
        id=f"c-{uuid.uuid4().hex[:8]}",
        author=user,
        body=body.body,
        created_at=datetime.now(timezone.utc),
    )
    data.setdefault("comments", []).append(comment.model_dump(mode="json"))
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    tickets[idx] = data
    store.write_json(store.TICKETS_PATH, tickets)
    return comment


@router.patch("/{ticket_id}/move")
def move_ticket(
    ticket_id: str,
    body: TicketMove,
    _user: Annotated[str, Depends(get_current_user)],
) -> Ticket:
    _valid_status(body.status)
    tickets = store.read_json(store.TICKETS_PATH)
    idx, data = _find_ticket(tickets, ticket_id)
    data["status"] = body.status
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    tickets[idx] = data
    store.write_json(store.TICKETS_PATH, tickets)
    return Ticket(**data)
