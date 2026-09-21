from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

CATEGORIES = {
    "flooring", "paint", "doors", "windows", "roofing", "staircase", "railing",
    "walls", "structConcrete", "structRebar", "structSteel", "foundation",
    "structTieColumn", "structRingBeam", "structFraming",
}
CONFIDENCE_LEVELS = {"high", "medium", "low"}


class MaterialSearchRequest(BaseModel):
    country: str = Field(..., min_length=2, max_length=2)
    category: str
    # Accepted for logging/relevance only — never part of the cache key.
    # Quantity math always stays client-side.
    quantity: float = 0
    unit: str = ""

    @field_validator("category")
    @classmethod
    def category_must_be_known(cls, v: str) -> str:
        if v not in CATEGORIES:
            raise ValueError(f"Unknown category: {v}")
        return v

    @field_validator("country")
    @classmethod
    def country_upper(cls, v: str) -> str:
        return v.upper()


class NormalizedMaterial(BaseModel):
    id: str
    materialName: str
    category: str
    country: str
    currency: str

    sourcePrice: float
    sourceUnit: str

    coverage: Optional[float] = None
    coverageUnit: Optional[str] = None

    normalizedPrice: float
    normalizedUnit: str

    recommendedWasteFactor: float = 0.05

    sourceName: str
    sourceUrl: Optional[str] = None
    sourceDate: str
    confidence: str

    # Set when the result is generic fallback data, not verified for the
    # requested country — the UI must show this, never hide it.
    note: Optional[str] = None

    @field_validator("confidence")
    @classmethod
    def confidence_known(cls, v: str) -> str:
        return v if v in CONFIDENCE_LEVELS else "low"


class MaterialSearchResponse(BaseModel):
    materials: List[NormalizedMaterial]
    cached: bool
    cachedAt: str
    country: str
    category: str
