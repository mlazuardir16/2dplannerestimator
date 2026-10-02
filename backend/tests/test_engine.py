"""Golden tests for the RAB engine — BUILDORA_ENGINE_SPEC.md §6.

Pure unit tests: no server, no database. Every rupiah value must match the
reference workbooks within ±Rp1.
"""
import math

import pytest

import engine
from engine.calc import labor_coef, material_coef

TOL = 1  # rupiah

TIPE36 = "tipe36_1lantai"
LB108 = "2lantai_lb108"

GOLDEN = {
    TIPE36: dict(swakelola=225_677_253, borongan=244_786_045, per_m2_borongan=5_342_826,
                 per_m2_swakelola=4_645_936, upah=55_534_640, weeks=18),
    LB108: dict(swakelola=516_601_137, borongan=559_217_347, per_m2_borongan=4_548_590,
                per_m2_swakelola=3_955_296, upah=141_133_453, weeks=24),
}


def run(template, edit=None):
    project = engine.load_project(template)
    if edit:
        edit(project)
    return engine.calculate(project)


@pytest.fixture(scope="module")
def results():
    return {t: run(t) for t in engine.TEMPLATES}


# ---------------------------------------------------------------- §6 table

@pytest.mark.parametrize("template", [TIPE36, LB108])
class TestGoldenTotals:
    def test_total_swakelola(self, results, template):
        assert results[template].swakelola.total == pytest.approx(GOLDEN[template]["swakelola"], abs=TOL)

    def test_total_borongan(self, results, template):
        assert results[template].borongan.total == pytest.approx(GOLDEN[template]["borongan"], abs=TOL)

    def test_per_m2_standard_borongan(self, results, template):
        assert results[template].price_check_borongan.per_m2 == pytest.approx(
            GOLDEN[template]["per_m2_borongan"], abs=TOL)

    def test_per_m2_standard_swakelola(self, results, template):
        assert results[template].price_check_swakelola.per_m2 == pytest.approx(
            GOLDEN[template]["per_m2_swakelola"], abs=TOL)

    def test_upah_total(self, results, template):
        assert results[template].upah_total == pytest.approx(GOLDEN[template]["upah"], abs=TOL)

    def test_duration_weeks(self, results, template):
        assert results[template].duration_weeks == GOLDEN[template]["weeks"]

    def test_price_check_status_matches_seed(self, results, template):
        expected = engine.load_project(template).golden["price_check_status"]
        assert results[template].price_check_borongan.status == expected


# ---------------------------------------------------------------- §6 edit tests

def bump_material(code, delta_per_pack):
    def edit(p):
        p.materials[code]["price_per_pack"] += delta_per_pack
    return edit


def bump_rate(trade, delta_per_day):
    def edit(p):
        p.labor_rates[trade]["rate"] += delta_per_day
    return edit


def set_margin(value):
    def edit(p):
        p.parameters["margin"] = value
    return edit


@pytest.mark.parametrize(
    "template, edit, field, expected_delta",
    [
        (TIPE36, bump_material("GRN", 20_000), "swakelola", 589_042),
        (TIPE36, bump_material("GRN", 20_000), "borongan", 627_774),
        (TIPE36, bump_rate("PKJ", 10_000), "borongan", 2_481_032),
        (LB108, bump_rate("PKJ", 10_000), "borongan", 6_307_894),
        (TIPE36, set_margin(0.20), "borongan", 10_642_872),
        (LB108, set_margin(0.20), "borongan", 24_313_798),
    ],
    ids=[
        "tipe36-granit+20k-swakelola",
        "tipe36-granit+20k-borongan",
        "tipe36-pekerja+10k-borongan",
        "lb108-pekerja+10k-borongan",
        "tipe36-margin20-borongan",
        "lb108-margin20-borongan",
    ],
)
def test_edit_delta(results, template, edit, field, expected_delta):
    before = getattr(results[template], field).total
    after = getattr(run(template, edit), field).total
    assert after - before == pytest.approx(expected_delta, abs=TOL)


def test_edits_do_not_leak_between_projects():
    p = engine.load_project(TIPE36)
    p.materials["GRN"]["price_per_pack"] += 1_000_000
    p.parameters["margin"] = 0.5
    fresh = engine.calculate(engine.load_project(TIPE36))
    assert fresh.borongan.total == pytest.approx(GOLDEN[TIPE36]["borongan"], abs=TOL)


# ---------------------------------------------------------------- volumes & structure

@pytest.mark.parametrize("template", [TIPE36, LB108])
def test_volume_formulas_reproduce_workbook(results, template):
    project = engine.load_project(template)
    for v in project.volumes:
        assert results[template].volumes[v["key"]] == pytest.approx(v["seed_value"], rel=1e-12), v["key"]


def test_volume_input_edit_flows_through():
    p = engine.load_project(TIPE36)
    p.set_volume_input("W", 7)
    r = engine.calculate(p)
    assert r.volumes["A"] == pytest.approx(42)
    assert r.volumes["LO"] == pytest.approx(26)
    assert r.borongan.total > GOLDEN[TIPE36]["borongan"]


def test_derived_volume_cannot_be_set_as_input():
    with pytest.raises(ValueError):
        engine.load_project(TIPE36).set_volume_input("A", 100)


@pytest.mark.parametrize("template", [TIPE36, LB108])
def test_totals_compose_per_spec(results, template):
    r = results[template]
    p = engine.load_project(template).parameters
    lines_sw = sum(l.bahan + l.upah for l in r.lines)
    non_bulk = sum(m.cost for m in r.materials.values() if not m.bulk)
    assert r.swakelola.delivery == pytest.approx(p["delivery_non_bulk"] * non_bulk)
    assert r.swakelola.subtotal == pytest.approx(lines_sw + r.swakelola.delivery)
    assert r.swakelola.contingency == pytest.approx(p["contingency_swakelola"] * r.swakelola.subtotal)
    assert r.swakelola.tax == 0  # both templates < 200 m²
    assert r.borongan.delivery == 0
    assert r.borongan.contingency == pytest.approx(p["contingency_borongan"] * r.borongan.subtotal)
    assert r.borongan.tax == 0  # contractor_pkp = 0
    assert sum(t["borongan"] for t in r.stage_totals.values()) == pytest.approx(r.borongan.subtotal)
    assert sum(sum(t.values()) for t in r.labor_upah.values()) == pytest.approx(r.upah_total)


def test_ppn_kms_applies_from_200_m2():
    p = engine.load_project(TIPE36)
    p.set_volume_input("W", 20)
    p.set_volume_input("D", 10)  # A = 200 m²
    r = engine.calculate(p)
    assert r.swakelola.tax == pytest.approx(0.022 * (r.swakelola.subtotal + r.swakelola.contingency))


def test_ppn_applies_when_contractor_pkp():
    p = engine.load_project(TIPE36)
    p.parameters["contractor_pkp"] = 1
    r = engine.calculate(p)
    assert r.borongan.tax == pytest.approx(0.11 * (r.borongan.subtotal + r.borongan.contingency))


def test_material_quantity_packs_and_cost(results):
    r = results[TIPE36]
    smn = r.materials["SMN"]
    assert smn.packs == math.ceil(smn.qty / 40 - 1e-4)
    assert smn.cost == pytest.approx(smn.qty * 63_000 / 40)
    # Granit: (GR 29.55 m² × 1.05) + (plint 61 m' × 0.105)
    assert r.materials["GRN"].qty == pytest.approx(29.55 * 1.05 + 61 * 0.105)
    # Installed packages never appear in the material list.
    assert set(r.materials) <= set(engine.load_project(TIPE36).materials)


def test_installed_packages_have_no_labor(results):
    for line in results[TIPE36].lines:
        if line.name == "Rangka atap baja ringan":
            assert line.upah == 0 and line.bahan_unit == 201_600


def test_coefficient_rounding_matches_workbook():
    assert labor_coef(0.02125) == 0.0213
    assert material_coef(16.40178571428571, {"waste": 0}) == 16.40179
    assert material_coef(163, {"waste": 0.05}) == 171.15


def test_lb108_schedule_overlap(results):
    sched = {s.code: s for s in results[LB108].schedule}
    assert sched["X"].start_week == sched["IX"].start_week
    assert sched["XI"].start_week == sched["IX"].start_week
    assert sched["XII"].start_week == sched["XI"].end_week + 1
    assert sum(s.weight for s in sched.values()) == pytest.approx(1)


def test_s_curve_and_progress_status(results):
    r = results[TIPE36]
    curve = engine.s_curve(r)
    assert len(curve) == r.duration_weeks
    assert curve[-1].planned_cumulative == pytest.approx(1)
    behind = engine.progress_status(r, week=6, stage_progress={"I": 1})
    assert behind.status == "TERLAMBAT"
    done = engine.progress_status(r, week=1, stage_progress={s.code: 1 for s in r.schedule})
    assert done.status == "LEBIH CEPAT"


def test_formula_evaluator_rejects_code():
    from engine.formula import evaluate
    with pytest.raises(ValueError):
        evaluate("__import__('os').system('true')", lambda _: 0)


def test_engine_seed_matches_docs_seed():
    """backend/engine/data must stay a byte-for-byte copy of docs/engine's seed."""
    from pathlib import Path
    from engine.seed import SEED_PATH
    docs_seed = Path(__file__).resolve().parents[2] / "docs" / "engine" / "buildora_engine_seed.json"
    assert docs_seed.read_bytes() == SEED_PATH.read_bytes()
