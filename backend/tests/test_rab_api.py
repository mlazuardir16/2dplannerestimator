"""RAB API tests — call the router/service functions directly (no server, no
database). Golden values must survive the API layer unchanged."""
import json

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from rab import router, service
from rab.schemas import RabRequest

TOL = 1

GOLDEN = {
    "tipe36_1lantai": (225_677_253, 244_786_045, 55_534_640, 18),
    "2lantai_lb108": (516_601_137, 559_217_347, 141_133_453, 24),
}


def calc(**kwargs):
    return service.calculate(RabRequest(**kwargs))


@pytest.mark.parametrize("template", list(GOLDEN))
def test_defaults_reproduce_golden_totals(template):
    sw, br, upah, weeks = GOLDEN[template]
    out = calc(template=template)
    assert out["swakelola"]["total"] == pytest.approx(sw, abs=TOL)
    assert out["borongan"]["total"] == pytest.approx(br, abs=TOL)
    assert out["upah_total"] == pytest.approx(upah, abs=TOL)
    assert out["duration_weeks"] == weeks
    json.dumps(out)  # response must be JSON-serialisable


def test_material_price_override_matches_golden_edit():
    base = calc(template="tipe36_1lantai")
    edited = calc(template="tipe36_1lantai", material_prices={"GRN": 195_000 + 20_000})
    assert edited["swakelola"]["total"] - base["swakelola"]["total"] == pytest.approx(589_042, abs=TOL)
    assert edited["borongan"]["total"] - base["borongan"]["total"] == pytest.approx(627_774, abs=TOL)


def test_labor_and_margin_overrides_match_golden_edits():
    base = calc(template="2lantai_lb108")
    wage = calc(template="2lantai_lb108", labor_rates={"PKJ": 130_500 + 10_000})
    margin = calc(template="2lantai_lb108", parameters={"margin": 0.20})
    assert wage["borongan"]["total"] - base["borongan"]["total"] == pytest.approx(6_307_894, abs=TOL)
    assert margin["borongan"]["total"] - base["borongan"]["total"] == pytest.approx(24_313_798, abs=TOL)


def test_volume_and_item_overrides():
    out = calc(template="tipe36_1lantai", volumes={"W": 7}, item_volumes={"VIII.2": 5})
    assert out["volumes"]["A"] == pytest.approx(42)
    line = next(l for l in out["lines"] if l["code"] == "VIII.2")
    assert line["volume"] == 5


def test_crew_and_pkp_parameters():
    base = calc(template="tipe36_1lantai")
    out = calc(template="tipe36_1lantai", parameters={"crew": 10, "contractor_pkp": True})
    assert out["crew"] == 10
    assert out["duration_weeks"] < base["duration_weeks"]
    b = out["borongan"]
    assert b["tax"] == pytest.approx(0.11 * (b["subtotal"] + b["contingency"]))


def test_progress_status_included_when_week_given():
    out = calc(template="tipe36_1lantai", current_week=6, stage_progress={"I": 1})
    assert out["progress"]["status"] == "TERLAMBAT"
    assert "progress" not in calc(template="tipe36_1lantai")


@pytest.mark.parametrize("bad", [
    {"volumes": {"A": 100}},  # derived key
    {"volumes": {"NOPE": 1}},
    {"item_volumes": {"XX.1": 1}},
    {"material_prices": {"NOPE": 1}},
    {"labor_rates": {"NOPE": 1}},
])
def test_unknown_or_derived_keys_are_rejected_with_422(bad):
    with pytest.raises(HTTPException) as exc:
        router.calculate(RabRequest(template="tipe36_1lantai", **bad))
    assert exc.value.status_code == 422


@pytest.mark.parametrize("bad", [
    {"template": "nope"},
    {"template": "tipe36_1lantai", "spec_class": "Super"},
    {"template": "tipe36_1lantai", "parameters": {"margin": 2}},
    {"template": "tipe36_1lantai", "parameters": {"crew": 0}},
])
def test_invalid_requests_fail_validation(bad):
    with pytest.raises(ValidationError):
        RabRequest(**bad)


def test_templates_catalogue():
    out = router.get_templates()
    json.dumps(out)
    by_key = {t["key"]: t for t in out["templates"]}
    assert set(by_key) == set(GOLDEN)
    assert by_key["2lantai_lb108"]["floors"] == 2

    t36 = by_key["tipe36_1lantai"]
    vols = {v["key"]: v for v in t36["volumes"]}
    assert vols["W"]["input"] and vols["W"]["default"] == 6
    assert not vols["A"]["input"] and vols["A"]["default"] == pytest.approx(36)

    items = {i["code"]: i for i in t36["items"]}
    assert items["VIII.2"]["volume_key"] is None and items["VIII.2"]["default_volume"] == 3
    assert items["II.1"]["volume_key"] == "GL"
    assert items["V.1"]["installed"] is True
    assert {m["code"] for m in out["materials"]} >= {"SMN", "GRN"}
