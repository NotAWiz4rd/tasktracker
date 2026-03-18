from __future__ import annotations

from fastapi.testclient import TestClient


def test_list_articles_empty(client: TestClient, auth_headers: dict) -> None:
    resp = client.get("/api/kb", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_and_get_article(client: TestClient, auth_headers: dict) -> None:
    resp = client.post(
        "/api/kb",
        json={"title": "Getting Started", "content": "# Hello\nWelcome!", "tags": ["onboarding"]},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    article = resp.json()
    assert article["slug"] == "getting-started"
    assert article["title"] == "Getting Started"
    assert article["content"] == "# Hello\nWelcome!"
    assert article["tags"] == ["onboarding"]
    assert article["created_by"] == "mike"
    assert article["parent"] is None

    # Fetch it back
    resp2 = client.get("/api/kb/getting-started", headers=auth_headers)
    assert resp2.status_code == 200
    assert resp2.json()["content"] == "# Hello\nWelcome!"
    assert resp2.json()["children"] == []


def test_create_with_custom_slug(client: TestClient, auth_headers: dict) -> None:
    resp = client.post(
        "/api/kb",
        json={"title": "My Article", "slug": "custom-slug"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["slug"] == "custom-slug"


def test_duplicate_slug_auto_increments(client: TestClient, auth_headers: dict) -> None:
    client.post("/api/kb", json={"title": "Test"}, headers=auth_headers)
    resp = client.post("/api/kb", json={"title": "Test"}, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.json()["slug"] == "test-2"


def test_update_article(client: TestClient, auth_headers: dict) -> None:
    client.post("/api/kb", json={"title": "Original", "content": "old"}, headers=auth_headers)

    resp = client.patch(
        "/api/kb/original",
        json={"title": "Updated", "content": "new content", "tags": ["docs"]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated"
    assert resp.json()["content"] == "new content"
    assert resp.json()["tags"] == ["docs"]


def test_delete_article(client: TestClient, auth_headers: dict) -> None:
    client.post("/api/kb", json={"title": "To Delete"}, headers=auth_headers)
    resp = client.delete("/api/kb/to-delete", headers=auth_headers)
    assert resp.status_code == 204

    resp = client.get("/api/kb/to-delete", headers=auth_headers)
    assert resp.status_code == 404


def test_article_not_found(client: TestClient, auth_headers: dict) -> None:
    resp = client.get("/api/kb/nonexistent", headers=auth_headers)
    assert resp.status_code == 404


def test_nested_articles(client: TestClient, auth_headers: dict) -> None:
    # Create parent
    client.post("/api/kb", json={"title": "Architecture"}, headers=auth_headers)
    # Create child
    resp = client.post(
        "/api/kb",
        json={"title": "Backend Overview", "parent": "architecture"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["parent"] == "architecture"

    # Get parent should include child
    resp = client.get("/api/kb/architecture", headers=auth_headers)
    children = resp.json()["children"]
    assert len(children) == 1
    assert children[0]["slug"] == "backend-overview"


def test_delete_parent_reparents_children(client: TestClient, auth_headers: dict) -> None:
    client.post("/api/kb", json={"title": "Parent"}, headers=auth_headers)
    client.post("/api/kb", json={"title": "Child", "parent": "parent"}, headers=auth_headers)

    client.delete("/api/kb/parent", headers=auth_headers)

    # Child should now be root-level
    resp = client.get("/api/kb/child", headers=auth_headers)
    assert resp.json()["parent"] is None


def test_filter_by_tag(client: TestClient, auth_headers: dict) -> None:
    client.post("/api/kb", json={"title": "A", "tags": ["setup"]}, headers=auth_headers)
    client.post("/api/kb", json={"title": "B", "tags": ["api"]}, headers=auth_headers)

    resp = client.get("/api/kb?tag=setup", headers=auth_headers)
    assert len(resp.json()) == 1
    assert resp.json()[0]["slug"] == "a"


def test_filter_by_parent(client: TestClient, auth_headers: dict) -> None:
    client.post("/api/kb", json={"title": "Root1"}, headers=auth_headers)
    client.post("/api/kb", json={"title": "Root2"}, headers=auth_headers)
    client.post("/api/kb", json={"title": "Child1", "parent": "root1"}, headers=auth_headers)

    # Filter root-level
    resp = client.get("/api/kb?parent=root", headers=auth_headers)
    assert len(resp.json()) == 2

    # Filter children of root1
    resp = client.get("/api/kb?parent=root1", headers=auth_headers)
    assert len(resp.json()) == 1
    assert resp.json()[0]["slug"] == "child1"


def test_search_articles(client: TestClient, auth_headers: dict) -> None:
    client.post("/api/kb", json={"title": "API Reference", "content": "endpoints documentation"}, headers=auth_headers)
    client.post("/api/kb", json={"title": "Setup Guide", "content": "install steps"}, headers=auth_headers)

    # Search by title
    resp = client.get("/api/kb?search=API", headers=auth_headers)
    assert len(resp.json()) == 1

    # Search by content
    resp = client.get("/api/kb?search=install", headers=auth_headers)
    assert len(resp.json()) == 1
    assert resp.json()[0]["slug"] == "setup-guide"


def test_self_parent_rejected(client: TestClient, auth_headers: dict) -> None:
    client.post("/api/kb", json={"title": "Self"}, headers=auth_headers)
    resp = client.patch("/api/kb/self", json={"parent": "self"}, headers=auth_headers)
    assert resp.status_code == 422


def test_invalid_parent_rejected(client: TestClient, auth_headers: dict) -> None:
    resp = client.post(
        "/api/kb",
        json={"title": "Orphan", "parent": "nonexistent"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_change_parent(client: TestClient, auth_headers: dict) -> None:
    client.post("/api/kb", json={"title": "Parent A"}, headers=auth_headers)
    client.post("/api/kb", json={"title": "Parent B"}, headers=auth_headers)
    client.post("/api/kb", json={"title": "Child", "parent": "parent-a"}, headers=auth_headers)

    # Move child to parent B
    resp = client.patch("/api/kb/child", json={"parent": "parent-b"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["parent"] == "parent-b"

    # Move child to root (set parent to null)
    resp = client.patch("/api/kb/child", json={"parent": None}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["parent"] is None

    # Verify it persisted
    resp = client.get("/api/kb/child", headers=auth_headers)
    assert resp.json()["parent"] is None


def test_unauthenticated_access(client: TestClient) -> None:
    resp = client.get("/api/kb")
    assert resp.status_code == 401
