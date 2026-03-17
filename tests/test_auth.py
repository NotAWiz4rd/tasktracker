from __future__ import annotations

from fastapi.testclient import TestClient


def test_login_success(client: TestClient) -> None:
    resp = client.post("/api/login", json={"username": "mike", "password": "1234"})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["user"]["id"] == "mike"
    assert data["user"]["name"] == "Mike"
    assert "password" not in data["user"]


def test_login_wrong_password(client: TestClient) -> None:
    resp = client.post("/api/login", json={"username": "mike", "password": "wrong"})
    assert resp.status_code == 401


def test_login_unknown_user(client: TestClient) -> None:
    resp = client.post("/api/login", json={"username": "nobody", "password": "1234"})
    assert resp.status_code == 401


def test_me_authenticated(client: TestClient, auth_headers: dict) -> None:
    resp = client.get("/api/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == "mike"


def test_me_no_token(client: TestClient) -> None:
    resp = client.get("/api/me")
    assert resp.status_code == 401


def test_me_invalid_token(client: TestClient) -> None:
    resp = client.get("/api/me", headers={"Authorization": "Bearer garbage"})
    assert resp.status_code == 401
