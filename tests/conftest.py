from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.seed import SEED_COLUMNS, SEED_CONFIG, SEED_TICKETS


@pytest.fixture(autouse=True)
def tmp_data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirect the data directory to a temp folder for each test."""
    import backend.store as store_mod
    import backend.kb_store as kb_store_mod

    data_dir = tmp_path / "data"
    data_dir.mkdir()

    # Write seed data
    (data_dir / "tickets.json").write_text(json.dumps(SEED_TICKETS))
    (data_dir / "columns.json").write_text(json.dumps(SEED_COLUMNS))
    (data_dir / "config.json").write_text(json.dumps(SEED_CONFIG))

    # Patch store paths
    monkeypatch.setattr(store_mod, "DATA_DIR", data_dir)
    monkeypatch.setattr(store_mod, "TICKETS_PATH", data_dir / "tickets.json")
    monkeypatch.setattr(store_mod, "COLUMNS_PATH", data_dir / "columns.json")
    monkeypatch.setattr(store_mod, "CONFIG_PATH", data_dir / "config.json")

    # Patch KB paths
    kb_dir = data_dir / "kb"
    articles_dir = kb_dir / "articles"
    monkeypatch.setattr(kb_store_mod, "KB_DIR", kb_dir)
    monkeypatch.setattr(kb_store_mod, "ARTICLES_DIR", articles_dir)
    monkeypatch.setattr(kb_store_mod, "KB_INDEX_PATH", kb_dir / "kb_index.json")
    kb_store_mod.ensure_kb_dirs()

    return data_dir


@pytest.fixture
def client() -> TestClient:
    from backend.main import app

    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def auth_token(client: TestClient) -> str:
    resp = client.post("/api/login", json={"username": "mike", "password": "1234"})
    assert resp.status_code == 200
    return resp.json()["token"]


@pytest.fixture
def auth_headers(auth_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth_token}"}
