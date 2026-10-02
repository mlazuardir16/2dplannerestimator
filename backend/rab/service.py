"""Glue between the HTTP API and the RAB engine: apply a request's overrides to
a fresh seed project, run the engine, and turn the result into JSON-ready
dicts. Kept free of FastAPI so it can be unit-tested directly."""

from dataclasses import asdict
from typing import Any, Dict, List

import engine
from engine.calc import item_volume

from .schemas import RabRequest

TEMPLATE_FLOORS = {"tipe36_1lantai": 1, "2lantai_lb108": 2}


class RabInputError(ValueError):
    """A request referenced something the template doesn't have."""


def build_project(req: RabRequest) -> engine.Project:
    project = engine.load_project(req.template, spec_class=req.spec_class)

    input_keys = {v["key"] for v in project.volumes if v["input"]}
    for key, value in req.volumes.items():
        if key not in input_keys:
            raise RabInputError(f"Unknown or derived volume key: {key}")
        project.set_volume_input(key, value)

    items = {item["code"]: item for item in project.items}
    for code, value in req.item_volumes.items():
        if code not in items:
            raise RabInputError(f"Unknown item code: {code}")
        items[code]["volume"] = value

    for code, price in req.material_prices.items():
        if code not in project.materials:
            raise RabInputError(f"Unknown material code: {code}")
        project.materials[code]["price_per_pack"] = price

    for code, rate in req.labor_rates.items():
        if code not in project.labor_rates:
            raise RabInputError(f"Unknown labour code: {code}")
        project.labor_rates[code]["rate"] = rate

    params = req.parameters.model_dump(exclude_none=True)
    crew = params.pop("crew", None)
    if crew is not None:
        project.crew = crew
    if "contractor_pkp" in params:
        params["contractor_pkp"] = int(params["contractor_pkp"])
    project.parameters.update(params)
    return project


def calculate(req: RabRequest) -> Dict[str, Any]:
    project = build_project(req)
    result = engine.calculate(project)

    lines = []
    for line in result.lines:
        d = asdict(line)
        d["swakelola"] = line.swakelola
        d["borongan"] = line.borongan
        lines.append(d)

    out: Dict[str, Any] = {
        "template": req.template,
        "spec_class": req.spec_class,
        "crew": project.crew,
        "parameters": project.parameters,
        "building_area": result.building_area,
        "volumes": result.volumes,
        "lines": lines,
        "stage_totals": result.stage_totals,
        "materials": [asdict(m) for m in result.materials.values()],
        "labor_oh": result.labor_oh,
        "labor_upah": result.labor_upah,
        "upah_total": result.upah_total,
        "swakelola": asdict(result.swakelola),
        "borongan": asdict(result.borongan),
        "schedule": [asdict(s) for s in result.schedule],
        "duration_weeks": result.duration_weeks,
        "s_curve": [asdict(p) for p in engine.s_curve(result)],
        "price_check": {
            "borongan": asdict(result.price_check_borongan),
            "swakelola": asdict(result.price_check_swakelola),
            "labor": asdict(result.price_check_labor),
        },
    }
    if req.current_week is not None:
        out["progress"] = asdict(engine.progress_status(result, req.current_week, req.stage_progress))
    return out


def templates() -> Dict[str, Any]:
    """Seed defaults for building the input screens."""
    seed = engine.load_seed()
    out: Dict[str, Any] = {
        "materials": [{"code": code, **m} for code, m in seed["materials"].items()],
        "labor_rates": [{"code": code, **r} for code, r in seed["labor_rates_per_day"].items()],
        "stages": seed["stages"],
        "parameters": seed["parameters"],
        "price_ranges": seed["price_ranges_per_m2_borongan"],
        "templates": [],
    }
    for key in engine.TEMPLATES:
        project = engine.load_project(key)
        volumes = engine.compute_volumes(project)
        out["templates"].append({
            "key": key,
            "description": project.description,
            "floors": TEMPLATE_FLOORS[key],
            "crew_default": project.crew,
            "volumes": [
                {k: v[k] for k in ("key", "label", "unit", "input")} | {"default": volumes[v["key"]]}
                for v in project.volumes
            ],
            "items": _items(project, volumes),
        })
    return out


def _items(project: engine.Project, volumes: Dict[str, float]) -> List[Dict[str, Any]]:
    out = []
    for item in project.items:
        expr = item["volume"]
        is_fixed = _is_number(expr)
        out.append({
            "code": item["code"],
            "group": item["group"],
            "name": item["name"],
            "unit": item["unit"],
            "item_type": item["item_type"],
            "reference": item["reference"],
            "installed": item.get("installed_package_price") is not None,
            # Fixed-number volumes are editable per item; the rest follow a
            # volume key and change through the volume inputs instead.
            "volume_key": None if is_fixed else expr,
            "default_volume": item_volume(item, volumes),
        })
    return out


def _is_number(value: Any) -> bool:
    try:
        float(value)
        return True
    except (TypeError, ValueError):
        return False
