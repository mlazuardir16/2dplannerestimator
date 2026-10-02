"""RAB calculation — implements §3 of docs/engine/BUILDORA_ENGINE_SPEC.md.

Money is never rounded: unit prices, line totals, material costs and wages
are carried at full precision. The one rounding step is on *coefficients*, to
match the reference workbooks (the golden source): the AHSP sheet stores labour
OH at 4 decimals and material coefficients — waste already included — at 5
decimals, and every quantity and price is computed from those stored values.
Packs and schedule days are ceil()ed, but never feed back into money.
"""

import math
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List

from .formula import evaluate, referenced_names
from .seed import Project

# Stages that start together with another stage instead of after the previous
# one. Every other stage starts the week after the stage listed before it —
# so XII follows XI even if IX is still running (Kurva-S: C16 = C15 + D15).
PARALLEL_STAGES = {"X": "IX", "XI": "IX"}

# Workbook: =MAX(0, ROUNDUP(qty / pack_size - 0.0001, 0)) — don't buy an extra
# pack for a rounding crumb.
PACK_TOLERANCE = 1e-4

LABOR_COEF_DECIMALS = 4
MATERIAL_COEF_DECIMALS = 5

STANDARD = "Standar"
STATUS_IN_RANGE = "Dalam rentang pasar"
S_CURVE_TOLERANCE = 0.05


def _ceil(x: float) -> int:
    # Guard against float noise such as 12.000000000000002 -> 13.
    return math.ceil(round(x, 9))


def _round_half_away(x: float) -> int:
    return int(math.floor(abs(x) + 0.5)) * (1 if x >= 0 else -1)


# ---------------------------------------------------------------- results

@dataclass
class Line:
    group: str
    name: str
    unit: str
    item_type: str
    reference: str
    volume: float
    bahan_unit: float
    upah_unit: float
    margin_unit: float
    bahan: float
    upah: float
    margin: float

    @property
    def swakelola(self) -> float:
        return self.bahan + self.upah

    @property
    def borongan(self) -> float:  # "JUMLAH" column of RAB Borongan
        return self.bahan + self.upah + self.margin


@dataclass
class MaterialLine:
    code: str
    name: str
    base_unit: str
    pack: str
    pack_size: float
    price_base: float
    qty: float
    packs: int
    cost: float
    bulk: bool
    reference: str


@dataclass
class Totals:
    subtotal: float
    delivery: float
    contingency: float
    tax: float
    total: float


@dataclass
class StageSchedule:
    code: str
    name: str
    oh: float
    days: int
    weeks: int
    start_week: int  # 1-based
    end_week: int  # inclusive
    weight: float  # share of total borongan JUMLAH


@dataclass
class PriceCheck:
    per_m2: float
    low: float
    high: float
    status: str


@dataclass
class Result:
    volumes: Dict[str, float]
    building_area: float
    lines: List[Line]
    materials: Dict[str, MaterialLine]
    labor_oh: Dict[str, Dict[str, float]]  # stage -> trade -> OH
    labor_upah: Dict[str, Dict[str, float]]  # stage -> trade -> Rp
    upah_total: float
    swakelola: Totals
    borongan: Totals
    stage_totals: Dict[str, Dict[str, float]]  # stage -> {bahan, upah, margin, swakelola, borongan}
    schedule: List[StageSchedule]
    duration_weeks: int
    price_check_borongan: PriceCheck
    price_check_swakelola: PriceCheck
    price_check_labor: PriceCheck
    extras: Dict[str, float] = field(default_factory=dict)


# ---------------------------------------------------------------- volumes

def compute_volumes(project: Project) -> Dict[str, float]:
    exprs = {v["key"]: v["expr"] for v in project.volumes}
    values: Dict[str, float] = {}
    visiting: set = set()

    def resolve(key: str) -> float:
        if key in values:
            return values[key]
        if key not in exprs:
            raise KeyError(f"Unknown volume key {key!r}")
        if key in visiting:
            raise ValueError(f"Circular volume formula involving {key!r}")
        visiting.add(key)
        values[key] = evaluate(exprs[key], resolve)
        visiting.discard(key)
        return values[key]

    for key in exprs:
        resolve(key)
    return values


def item_volume(item: Dict, volumes: Dict[str, float]) -> float:
    expr = item["volume"]
    if isinstance(expr, str):
        for name in referenced_names(expr):
            if name not in volumes:
                raise KeyError(f"Item {item['name']!r} references unknown volume {name!r}")
    return evaluate(expr, volumes.__getitem__)


# ---------------------------------------------------------------- unit prices

def price_base(material: Dict) -> float:
    return material["price_per_pack"] / material["pack_size"]


def material_coef(coef: float, material: Dict) -> float:
    """Coefficient per unit of work including waste, as stored in the AHSP sheet."""
    return round(coef * (1 + material["waste"]), MATERIAL_COEF_DECIMALS)


def labor_coef(oh: float) -> float:
    return round(oh, LABOR_COEF_DECIMALS)


def bahan_unit(item: Dict, materials: Dict[str, Dict]) -> float:
    if item.get("installed_package_price") is not None:
        return float(item["installed_package_price"])
    return sum(
        material_coef(coef, materials[code]) * price_base(materials[code])
        for code, coef in item["materials"].items()
    )


def upah_unit(item: Dict, rates: Dict[str, Dict]) -> float:
    return sum(labor_coef(oh) * rates[trade]["rate"] for trade, oh in item["labor_OH"].items())


# ---------------------------------------------------------------- main entry

def calculate(project: Project) -> Result:
    p = project.parameters
    margin = p["margin"]
    volumes = compute_volumes(project)
    area = volumes["A"]

    lines: List[Line] = []
    mat_qty: Dict[str, float] = defaultdict(float)
    labor_oh: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    for item in project.items:
        vol = item_volume(item, volumes)
        b_u = bahan_unit(item, project.materials)
        u_u = upah_unit(item, project.labor_rates)
        m_u = (b_u + u_u) * margin
        lines.append(Line(
            group=item["group"], name=item["name"], unit=item["unit"],
            item_type=item["item_type"], reference=item["reference"],
            volume=vol, bahan_unit=b_u, upah_unit=u_u, margin_unit=m_u,
            bahan=vol * b_u, upah=vol * u_u, margin=vol * m_u,
        ))
        if item.get("installed_package_price") is None:
            for code, coef in item["materials"].items():
                mat_qty[code] += vol * material_coef(coef, project.materials[code])
        for trade, oh in item["labor_OH"].items():
            labor_oh[item["group"]][trade] += vol * labor_coef(oh)

    materials = _material_lines(project, mat_qty)

    labor_upah = {
        stage: {t: oh * project.labor_rates[t]["rate"] for t, oh in trades.items()}
        for stage, trades in labor_oh.items()
    }
    upah_total = sum(l.upah for l in lines)

    # Swakelola
    delivery = p["delivery_non_bulk"] * sum(m.cost for m in materials.values() if not m.bulk)
    sw_sub = sum(l.swakelola for l in lines) + delivery
    sw_cont = p["contingency_swakelola"] * sw_sub
    sw_tax = p["ppn_kms"] * (sw_sub + sw_cont) if area >= p["ppn_kms_min_area_m2"] else 0.0
    swakelola = Totals(sw_sub, delivery, sw_cont, sw_tax, sw_sub + sw_cont + sw_tax)

    # Borongan
    br_sub = sum(l.borongan for l in lines)
    br_cont = p["contingency_borongan"] * br_sub
    br_tax = p["ppn_effective"] * (br_sub + br_cont) if p["contractor_pkp"] else 0.0
    borongan = Totals(br_sub, 0.0, br_cont, br_tax, br_sub + br_cont + br_tax)

    stage_totals = _stage_totals(project, lines)
    schedule = _schedule(project, labor_oh, stage_totals, br_sub)
    duration = max((s.end_week for s in schedule), default=0)

    # Price-per-m² control (standard items only)
    std = [l for l in lines if l.item_type == STANDARD]
    lo, hi = project.price_ranges[project.spec_class]
    jl, jh = project.price_ranges["borongan_jasa"]
    per_m2_b = sum(l.borongan for l in std) / area
    per_m2_s = sum(l.swakelola for l in std) / area
    per_m2_labor = sum(l.upah for l in std) * (1 + margin) / area

    return Result(
        volumes=volumes,
        building_area=area,
        lines=lines,
        materials=materials,
        labor_oh={s: dict(t) for s, t in labor_oh.items()},
        labor_upah=labor_upah,
        upah_total=upah_total,
        swakelola=swakelola,
        borongan=borongan,
        stage_totals=stage_totals,
        schedule=schedule,
        duration_weeks=duration,
        price_check_borongan=_price_check(per_m2_b, lo, hi),
        price_check_swakelola=_price_check(per_m2_s, lo / (1 + margin), hi / (1 + margin)),
        price_check_labor=_price_check(per_m2_labor, jl, jh),
    )


def _material_lines(project: Project, qty: Dict[str, float]) -> Dict[str, MaterialLine]:
    out: Dict[str, MaterialLine] = {}
    for code, q in qty.items():
        m = project.materials[code]
        pb = price_base(m)
        out[code] = MaterialLine(
            code=code, name=m["name"], base_unit=m["base_unit"], pack=m["pack"],
            pack_size=m["pack_size"], price_base=pb, qty=q,
            packs=max(0, math.ceil(q / m["pack_size"] - PACK_TOLERANCE)),
            cost=q * pb,
            bulk=bool(m["bulk"]),
            reference=m["reference"],
        )
    return out


def _stage_totals(project: Project, lines: List[Line]) -> Dict[str, Dict[str, float]]:
    totals = {s["code"]: dict(bahan=0.0, upah=0.0, margin=0.0, swakelola=0.0, borongan=0.0) for s in project.stages}
    for l in lines:
        t = totals[l.group]
        t["bahan"] += l.bahan
        t["upah"] += l.upah
        t["margin"] += l.margin
        t["swakelola"] += l.swakelola
        t["borongan"] += l.borongan
    return totals


def _schedule(project, labor_oh, stage_totals, borongan_sum) -> List[StageSchedule]:
    crew = project.crew
    per_week = project.parameters["workdays_per_week"]
    out: Dict[str, StageSchedule] = {}
    next_start = 1
    for s in project.stages:
        code = s["code"]
        oh = sum(labor_oh.get(code, {}).values())
        days = _ceil(oh / crew)
        weeks = max(1, _ceil(days / per_week))
        anchor = PARALLEL_STAGES.get(code)
        start = out[anchor].start_week if anchor in out else next_start
        out[code] = StageSchedule(
            code=code, name=s["name"], oh=oh, days=days, weeks=weeks,
            start_week=start, end_week=start + weeks - 1,
            weight=stage_totals[code]["borongan"] / borongan_sum if borongan_sum else 0.0,
        )
        next_start = out[code].end_week + 1
    return list(out.values())


def _price_check(value: float, low: float, high: float) -> PriceCheck:
    if value < low:
        pct = _round_half_away((value / low - 1) * 100)
        status = f"Di bawah rentang ({pct}%) — periksa apakah ada pekerjaan/spesifikasi yang terlewat"
    elif value > high:
        pct = _round_half_away((value / high - 1) * 100)
        status = f"Di atas rentang (+{pct}%) — periksa spesifikasi atau harga yang terlalu tinggi"
    else:
        status = STATUS_IN_RANGE
    return PriceCheck(per_m2=value, low=low, high=high, status=status)


# ---------------------------------------------------------------- S-curve

@dataclass
class SCurvePoint:
    week: int
    planned_weekly: float
    planned_cumulative: float


@dataclass
class SCurveStatus:
    week: int
    planned: float
    actual: float
    deviation: float
    status: str


def s_curve(result: Result) -> List[SCurvePoint]:
    """Planned progress: each stage's weight spread evenly over its weeks."""
    weekly = [0.0] * result.duration_weeks
    for s in result.schedule:
        for w in range(s.start_week, s.end_week + 1):
            weekly[w - 1] += s.weight / s.weeks
    points, cum = [], 0.0
    for i, w in enumerate(weekly, start=1):
        cum += w
        points.append(SCurvePoint(week=i, planned_weekly=w, planned_cumulative=cum))
    return points


def progress_status(result: Result, week: int, stage_progress: Dict[str, float]) -> SCurveStatus:
    """`stage_progress` maps stage code -> completed fraction (0..1)."""
    curve = s_curve(result)
    planned = curve[min(max(week, 1), len(curve)) - 1].planned_cumulative if curve else 0.0
    actual = sum(s.weight * stage_progress.get(s.code, 0.0) for s in result.schedule)
    dev = actual - planned
    if dev < -S_CURVE_TOLERANCE:
        status = "TERLAMBAT"
    elif dev > S_CURVE_TOLERANCE:
        status = "LEBIH CEPAT"
    else:
        status = "SESUAI RENCANA"
    return SCurveStatus(week=week, planned=planned, actual=actual, deviation=dev, status=status)
