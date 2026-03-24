"""Tests for attachment upload, download, delete, size limits, and cleanup."""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def ticket_id(client: TestClient, auth_headers: dict) -> str:
    """Create a ticket and return its ID."""
    resp = client.post("/api/tickets", headers=auth_headers, json={"title": "Test Ticket"})
    assert resp.status_code == 201
    return resp.json()["id"]


def test_upload_ticket_attachment(client: TestClient, auth_headers: dict, tmp_data_dir: Path, ticket_id: str):
    resp = client.post(
        f"/api/tickets/{ticket_id}/attachments",
        headers=auth_headers,
        files={"file": ("test.txt", b"hello world", "text/plain")},
    )
    assert resp.status_code == 201
    att = resp.json()
    assert att["filename"] == "test.txt"
    assert att["content_type"] == "text/plain"
    assert att["size_bytes"] == 11
    assert att["id"].startswith("att-")

    # Verify file on disk
    att_path = tmp_data_dir / "attachments" / f"{att['id']}.txt"
    assert att_path.exists()
    assert att_path.read_bytes() == b"hello world"

    # Verify attachment is in ticket data
    resp = client.get(f"/api/tickets/{ticket_id}", headers=auth_headers)
    ticket = resp.json()
    assert len(ticket["attachments"]) == 1
    assert ticket["attachments"][0]["id"] == att["id"]


def test_download_attachment(client: TestClient, auth_headers: dict, ticket_id: str):
    resp = client.post(
        f"/api/tickets/{ticket_id}/attachments",
        headers=auth_headers,
        files={"file": ("doc.pdf", b"pdf-content", "application/pdf")},
    )
    att = resp.json()

    resp = client.get(f"/api/attachments/{att['id']}/doc.pdf", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.content == b"pdf-content"


def test_delete_ticket_attachment(client: TestClient, auth_headers: dict, tmp_data_dir: Path, ticket_id: str):
    resp = client.post(
        f"/api/tickets/{ticket_id}/attachments",
        headers=auth_headers,
        files={"file": ("rm.txt", b"delete me", "text/plain")},
    )
    att = resp.json()
    att_path = tmp_data_dir / "attachments" / f"{att['id']}.txt"
    assert att_path.exists()

    resp = client.delete(f"/api/tickets/{ticket_id}/attachments/{att['id']}", headers=auth_headers)
    assert resp.status_code == 204

    resp = client.get(f"/api/tickets/{ticket_id}", headers=auth_headers)
    assert len(resp.json()["attachments"]) == 0
    assert not att_path.exists()


def test_file_size_limit(client: TestClient, auth_headers: dict, ticket_id: str):
    big_data = b"x" * (10 * 1024 * 1024 + 1)  # Just over 10 MB
    resp = client.post(
        f"/api/tickets/{ticket_id}/attachments",
        headers=auth_headers,
        files={"file": ("big.bin", big_data, "application/octet-stream")},
    )
    assert resp.status_code == 413


def test_delete_ticket_cleans_up_attachments(client: TestClient, auth_headers: dict, tmp_data_dir: Path, ticket_id: str):
    resp = client.post(
        f"/api/tickets/{ticket_id}/attachments",
        headers=auth_headers,
        files={"file": ("cleanup.txt", b"data", "text/plain")},
    )
    att = resp.json()
    att_path = tmp_data_dir / "attachments" / f"{att['id']}.txt"
    assert att_path.exists()

    resp = client.delete(f"/api/tickets/{ticket_id}", headers=auth_headers)
    assert resp.status_code == 204
    assert not att_path.exists()


def test_kb_attachment_lifecycle(client: TestClient, auth_headers: dict, tmp_data_dir: Path):
    resp = client.post("/api/kb", headers=auth_headers, json={"title": "Test Article"})
    assert resp.status_code == 201
    slug = resp.json()["slug"]

    resp = client.post(
        f"/api/kb/{slug}/attachments",
        headers=auth_headers,
        files={"file": ("diagram.png", b"png-data", "image/png")},
    )
    assert resp.status_code == 201
    att = resp.json()
    att_path = tmp_data_dir / "attachments" / f"{att['id']}.png"
    assert att_path.exists()

    resp = client.get(f"/api/kb/{slug}", headers=auth_headers)
    assert len(resp.json()["attachments"]) == 1

    resp = client.delete(f"/api/kb/{slug}/attachments/{att['id']}", headers=auth_headers)
    assert resp.status_code == 204
    assert not att_path.exists()

    resp = client.get(f"/api/kb/{slug}", headers=auth_headers)
    assert len(resp.json()["attachments"]) == 0


def test_delete_article_cleans_up_attachments(client: TestClient, auth_headers: dict, tmp_data_dir: Path):
    resp = client.post("/api/kb", headers=auth_headers, json={"title": "Cleanup Article"})
    slug = resp.json()["slug"]

    resp = client.post(
        f"/api/kb/{slug}/attachments",
        headers=auth_headers,
        files={"file": ("file.txt", b"content", "text/plain")},
    )
    att = resp.json()
    att_path = tmp_data_dir / "attachments" / f"{att['id']}.txt"
    assert att_path.exists()

    resp = client.delete(f"/api/kb/{slug}", headers=auth_headers)
    assert resp.status_code == 204
    assert not att_path.exists()


def test_attachment_not_found(client: TestClient, auth_headers: dict, ticket_id: str):
    resp = client.delete(f"/api/tickets/{ticket_id}/attachments/att-nonexistent", headers=auth_headers)
    assert resp.status_code == 404

    resp = client.get("/api/attachments/att-nonexistent/file.txt", headers=auth_headers)
    assert resp.status_code == 404
