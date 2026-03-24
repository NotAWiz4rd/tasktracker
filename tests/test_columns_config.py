from __future__ import annotations

from fastapi.testclient import TestClient


def test_list_columns(client: TestClient, auth_headers: dict) -> None:
    resp = client.get("/api/columns", headers=auth_headers)
    assert resp.status_code == 200
    cols = resp.json()["columns"]
    assert len(cols) == 4
    assert cols[0]["id"] == "backlog"
    assert cols[-1]["id"] == "done"


def test_get_config(client: TestClient) -> None:
    # Config endpoint is public (no auth needed for login screen)
    resp = client.get("/api/config")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["users"]) == 3
    assert data["users"][0]["id"] == "mike"
    # Passwords must not be exposed
    assert "password" not in data["users"][0]
    assert "next_ticket_number" not in data
    assert "high" in data["priorities"]
    assert "backend" in data["labels"]
