"""Load the Buildora seed JSON into an editable `Project`.

Every price, wage, coefficient, parameter and volume input on a `Project` is a
plain dict/list value — callers edit them in place and re-run
`engine.calculate(project)`. `load_project` always returns a fresh deep copy,
so edits never leak between projects.
"""

import copy
import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List

from .formula import excel_to_expr

SEED_PATH = Path(__file__).parent / "data" / "buildora_engine_seed.json"

# Layout of the reference workbook's "Volume" sheet: inputs start at row 6,
# and the derived block starts after one blank row below the last input.
VOLUME_FIRST_ROW = 6

TEMPLATES = ("tipe36_1lantai", "2lantai_lb108")


@dataclass
class Project:
    template: str
    description: str
    spec_class: str
    crew: int
    volumes: List[Dict[str, Any]]  # {key, label, input, expr, unit, seed_value}
    items: List[Dict[str, Any]]
    materials: Dict[str, Dict[str, Any]]
    labor_rates: Dict[str, Dict[str, Any]]
    stages: List[Dict[str, str]]
    parameters: Dict[str, Any]
    price_ranges: Dict[str, List[float]]
    golden: Dict[str, Any] = field(default_factory=dict)

    def set_volume_input(self, key: str, value: float) -> None:
        for v in self.volumes:
            if v["key"] == key:
                if not v["input"]:
                    raise ValueError(f"Volume {key!r} is derived; edit its formula instead")
                v["expr"] = value
                return
        raise KeyError(key)


@lru_cache(maxsize=1)
def _raw_seed() -> Dict[str, Any]:
    with open(SEED_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def load_seed() -> Dict[str, Any]:
    return copy.deepcopy(_raw_seed())


def _volume_rows(volumes: List[Dict[str, Any]]) -> Dict[int, str]:
    n_inputs = sum(1 for v in volumes if v["input"])
    rows: Dict[int, str] = {}
    for i, v in enumerate(volumes):
        offset = i if v["input"] else i + 1  # skip the blank separator row
        rows[VOLUME_FIRST_ROW + offset] = v["key"]
    # Inputs must come first for the row layout above to hold.
    if any(not v["input"] for v in volumes[:n_inputs]):
        raise ValueError("Seed volumes must list all inputs before derived values")
    return rows


def _assign_item_codes(items: List[Dict[str, Any]]) -> None:
    """Number items per stage in seed order — "II.3" is the 3rd item of stage
    II, the same numbering as the workbook's RAB sheets."""
    counters: Dict[str, int] = {}
    for item in items:
        counters[item["group"]] = counters.get(item["group"], 0) + 1
        item["code"] = f'{item["group"]}.{counters[item["group"]]}'


def load_project(template: str, spec_class: str = "Menengah") -> Project:
    seed = load_seed()
    if template not in seed:
        raise KeyError(f"Unknown template {template!r}; expected one of {TEMPLATES}")
    tpl = seed[template]

    _assign_item_codes(tpl["items"])
    row_to_key = _volume_rows(tpl["volumes"])
    volumes = [
        {
            "key": v["key"],
            "label": v["label"],
            "input": v["input"],
            "expr": v["value_or_formula"] if v["input"] else excel_to_expr(v["value_or_formula"], row_to_key),
            "unit": v["unit"],
            "seed_value": v["computed"],
        }
        for v in tpl["volumes"]
    ]

    return Project(
        template=template,
        description=tpl["description"],
        spec_class=spec_class,
        crew=tpl["crew_default"],
        volumes=volumes,
        items=tpl["items"],
        materials=seed["materials"],
        labor_rates=seed["labor_rates_per_day"],
        stages=seed["stages"],
        parameters=seed["parameters"],
        price_ranges=seed["price_ranges_per_m2_borongan"],
        golden=tpl["golden"],
    )
