"""Request schema for the RAB API. Responses are plain dicts built in service.py."""

from typing import Dict, Literal, Optional

from pydantic import BaseModel, Field

SpecClass = Literal["Sederhana", "Menengah", "Mewah"]


class RabParameters(BaseModel):
    margin: Optional[float] = Field(None, ge=0, le=1)
    contingency_swakelola: Optional[float] = Field(None, ge=0, le=1)
    contingency_borongan: Optional[float] = Field(None, ge=0, le=1)
    delivery_non_bulk: Optional[float] = Field(None, ge=0, le=1)
    contractor_pkp: Optional[bool] = None
    crew: Optional[int] = Field(None, ge=1, le=100)


class RabRequest(BaseModel):
    """Everything is optional except the template: omitted values keep the
    seed defaults, so `{"template": "tipe36_1lantai"}` reproduces the golden
    workbook totals."""

    template: Literal["tipe36_1lantai", "2lantai_lb108"]
    spec_class: SpecClass = "Menengah"
    # Volume *inputs* by key (e.g. {"W": 6, "LI": 10.5}); derived keys are rejected.
    volumes: Dict[str, float] = Field(default_factory=dict)
    # Fixed item volumes by item code (e.g. {"VIII.2": 4}).
    item_volumes: Dict[str, float] = Field(default_factory=dict)
    # Price per purchase pack by material code.
    material_prices: Dict[str, float] = Field(default_factory=dict)
    # Daily wage by trade code.
    labor_rates: Dict[str, float] = Field(default_factory=dict)
    parameters: RabParameters = Field(default_factory=RabParameters)
    # S-curve: completed fraction (0..1) per stage, evaluated at current_week.
    stage_progress: Dict[str, float] = Field(default_factory=dict)
    current_week: Optional[int] = Field(None, ge=1)
