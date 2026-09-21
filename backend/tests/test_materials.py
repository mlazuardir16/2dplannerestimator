"""Backend API tests for the country-aware material-recommendation endpoint."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
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

NORMALIZED_MATERIAL_FIELDS = {
    "id", "materialName", "category", "country", "currency",
    "sourcePrice", "sourceUnit", "coverage", "coverageUnit",
    "normalizedPrice", "normalizedUnit", "recommendedWasteFactor",
    "sourceName", "sourceUrl", "sourceDate", "confidence", "note",
}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_materials_search_returns_normalized_shape(session):
    r = session.post(f"{API}/materials/search", json={
        "country": "ID", "category": "flooring", "quantity": 24, "unit": "m2",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert 1 <= len(data["materials"]) <= 3
    for m in data["materials"]:
        assert NORMALIZED_MATERIAL_FIELDS.issuperset(m.keys())
        assert m["confidence"] in {"high", "medium", "low"}
        assert m["sourcePrice"] > 0
        assert m["normalizedPrice"] > 0


def test_materials_search_unknown_category(session):
    r = session.post(f"{API}/materials/search", json={
        "country": "ID", "category": "not-a-real-category", "quantity": 1, "unit": "m2",
    })
    assert r.status_code == 422


def test_materials_search_cache_hit(session):
    body = {"country": "GB", "category": "paint", "quantity": 10, "unit": "m2"}
    r1 = session.post(f"{API}/materials/search", json=body)
    assert r1.status_code == 200
    r2 = session.post(f"{API}/materials/search", json=body)
    assert r2.status_code == 200
    assert r2.json()["cached"] is True
    assert r1.json()["cachedAt"] == r2.json()["cachedAt"]


def test_materials_cache_key_ignores_quantity(session):
    r1 = session.post(f"{API}/materials/search", json={
        "country": "US", "category": "doors", "quantity": 3, "unit": "unit",
    })
    r2 = session.post(f"{API}/materials/search", json={
        "country": "US", "category": "doors", "quantity": 300, "unit": "unit",
    })
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["materials"] == r2.json()["materials"]
    assert r2.json()["cached"] is True


def test_materials_search_unknown_country_falls_back_to_generic(session):
    r = session.post(f"{API}/materials/search", json={
        "country": "ZZ", "category": "windows", "quantity": 5, "unit": "unit",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["materials"]) >= 1
    assert data["materials"][0]["confidence"] == "low"
    assert data["materials"][0]["note"]
