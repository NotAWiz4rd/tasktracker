from __future__ import annotations

from fastapi.testclient import TestClient


def test_create_and_get_ticket(client: TestClient, auth_headers: dict) -> None:
    resp = client.post(
        "/api/tickets",
        json={"title": "First ticket", "priority": "high", "labels": ["backend"]},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    ticket = resp.json()
    assert ticket["id"] == "TT-1"
    assert ticket["title"] == "First ticket"
    assert ticket["priority"] == "high"
    assert ticket["status"] == "backlog"
    assert ticket["created_by"] == "mike"

    # Fetch it back
    resp2 = client.get(f"/api/tickets/{ticket['id']}", headers=auth_headers)
    assert resp2.status_code == 200
    assert resp2.json()["title"] == "First ticket"


def test_list_tickets_empty(client: TestClient, auth_headers: dict) -> None:
    resp = client.get("/api/tickets", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_tickets_with_filters(client: TestClient, auth_headers: dict) -> None:
    client.post("/api/tickets", json={"title": "A", "priority": "high", "status": "todo"}, headers=auth_headers)
    client.post("/api/tickets", json={"title": "B", "priority": "low", "status": "backlog"}, headers=auth_headers)
    client.post("/api/tickets", json={"title": "C", "priority": "high", "status": "todo", "labels": ["bug"]}, headers=auth_headers)

    # Filter by status
    resp = client.get("/api/tickets?status=todo", headers=auth_headers)
    assert len(resp.json()) == 2

    # Filter by priority
    resp = client.get("/api/tickets?priority=low", headers=auth_headers)
    assert len(resp.json()) == 1
    assert resp.json()[0]["title"] == "B"

    # Filter by label
    resp = client.get("/api/tickets?label=bug", headers=auth_headers)
    assert len(resp.json()) == 1
    assert resp.json()[0]["title"] == "C"

    # Search
    resp = client.get("/api/tickets?search=B", headers=auth_headers)
    assert len(resp.json()) == 1


def test_update_ticket(client: TestClient, auth_headers: dict) -> None:
    resp = client.post("/api/tickets", json={"title": "Original"}, headers=auth_headers)
    tid = resp.json()["id"]

    resp = client.patch(f"/api/tickets/{tid}", json={"title": "Updated", "priority": "urgent"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated"
    assert resp.json()["priority"] == "urgent"


def test_delete_ticket(client: TestClient, auth_headers: dict) -> None:
    resp = client.post("/api/tickets", json={"title": "To delete"}, headers=auth_headers)
    tid = resp.json()["id"]

    resp = client.delete(f"/api/tickets/{tid}", headers=auth_headers)
    assert resp.status_code == 204

    resp = client.get(f"/api/tickets/{tid}", headers=auth_headers)
    assert resp.status_code == 404


def test_ticket_not_found(client: TestClient, auth_headers: dict) -> None:
    resp = client.get("/api/tickets/TT-999", headers=auth_headers)
    assert resp.status_code == 404


def test_move_ticket(client: TestClient, auth_headers: dict) -> None:
    resp = client.post("/api/tickets", json={"title": "Movable"}, headers=auth_headers)
    tid = resp.json()["id"]
    assert resp.json()["status"] == "backlog"

    resp = client.patch(f"/api/tickets/{tid}/move", json={"status": "in-progress"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "in-progress"


def test_move_ticket_invalid_status(client: TestClient, auth_headers: dict) -> None:
    resp = client.post("/api/tickets", json={"title": "Bad move"}, headers=auth_headers)
    tid = resp.json()["id"]

    resp = client.patch(f"/api/tickets/{tid}/move", json={"status": "nonexistent"}, headers=auth_headers)
    assert resp.status_code == 422


def test_add_comment(client: TestClient, auth_headers: dict) -> None:
    resp = client.post("/api/tickets", json={"title": "With comments"}, headers=auth_headers)
    tid = resp.json()["id"]

    resp = client.post(f"/api/tickets/{tid}/comments", json={"body": "Hello!"}, headers=auth_headers)
    assert resp.status_code == 201
    comment = resp.json()
    assert comment["body"] == "Hello!"
    assert comment["author"] == "mike"

    # Verify comment is on the ticket
    resp = client.get(f"/api/tickets/{tid}", headers=auth_headers)
    assert len(resp.json()["comments"]) == 1


def test_create_ticket_invalid_status(client: TestClient, auth_headers: dict) -> None:
    resp = client.post(
        "/api/tickets",
        json={"title": "Bad", "status": "nonexistent"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_unauthenticated_access(client: TestClient) -> None:
    resp = client.get("/api/tickets")
    assert resp.status_code == 401


def test_ticket_id_auto_increments(client: TestClient, auth_headers: dict) -> None:
    r1 = client.post("/api/tickets", json={"title": "T1"}, headers=auth_headers)
    r2 = client.post("/api/tickets", json={"title": "T2"}, headers=auth_headers)
    assert r1.json()["id"] == "TT-1"
    assert r2.json()["id"] == "TT-2"
