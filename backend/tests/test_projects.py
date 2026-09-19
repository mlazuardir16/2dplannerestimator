"""Backend API tests for Floor Planner + RAB project CRUD endpoints."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback: read from frontend/.env
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass
BASE_URL = (BASE_URL or "").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_ids():
    return []


# ---- Root / health ----
def test_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert "message" in r.json()


# ---- List ----
def test_list_projects(session):
    r = session.get(f"{API}/projects")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    # summary projection - _id excluded
    for d in data:
        assert "_id" not in d


# ---- Create ----
def test_create_project(session, created_ids):
    payload = {
        "name": "TEST_Project_" + uuid.uuid4().hex[:6],
        "client": "TEST Client",
        "location": "TEST",
        "currency": "USD",
        "building": {"width": 10, "length": 12},
        "floors": [{"id": "f1", "level": 0, "name": "Floor 1", "height": 3.2,
                    "walls": [], "doors": [], "windows": [], "columns": [], "utilities": [], "roomNames": {}}],
        "floorCount": 1,
        "estimatedCost": 0,
        "buildingArea": 120,
    }
    r = session.post(f"{API}/projects", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["id"]
    assert data["name"] == payload["name"]
    assert "createdAt" in data and "updatedAt" in data
    assert "_id" not in data
    created_ids.append(data["id"])


# ---- Get ----
def test_get_project(session, created_ids):
    pid = created_ids[0]
    r = session.get(f"{API}/projects/{pid}")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == pid
    assert "_id" not in data
    assert data["floors"][0]["name"] == "Floor 1"


def test_get_project_404(session):
    r = session.get(f"{API}/projects/nonexistent-{uuid.uuid4().hex}")
    assert r.status_code == 404


# ---- Update ----
def test_update_project(session, created_ids):
    pid = created_ids[0]
    patch = {
        "name": "TEST_Updated_" + uuid.uuid4().hex[:4],
        "client": "TEST Updated Client",
        "estimatedCost": 12345.67,
        "floors": [{"id": "f1", "level": 0, "name": "F1", "height": 3.2,
                    "walls": [], "doors": [], "windows": [], "columns": [], "utilities": [], "roomNames": {}}],
    }
    r = session.put(f"{API}/projects/{pid}", json=patch)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == patch["name"]
    assert data["estimatedCost"] == 12345.67
    assert "_id" not in data

    # Verify persisted
    r2 = session.get(f"{API}/projects/{pid}")
    assert r2.status_code == 200
    assert r2.json()["name"] == patch["name"]


# ---- PUT upsert on new id ----
def test_put_upsert(session, created_ids):
    new_id = "test-upsert-" + uuid.uuid4().hex[:8]
    r = session.put(f"{API}/projects/{new_id}", json={"name": "TEST_Upsert", "floors": []})
    assert r.status_code == 200
    assert r.json()["id"] == new_id
    created_ids.append(new_id)


# ---- Delete ----
def test_delete_project(session, created_ids):
    for pid in created_ids:
        r = session.delete(f"{API}/projects/{pid}")
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # verify gone
        r2 = session.get(f"{API}/projects/{pid}")
        assert r2.status_code == 404
    created_ids.clear()
