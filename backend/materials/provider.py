"""MaterialResearchProvider abstraction.

The rest of the app never talks to a search/AI backend directly — it only
calls `provider.get_recommendations(country, category)`. This lets the real
research implementation (e.g. a web-search-backed provider) be swapped in
later by changing the single instantiation point in server.py, without
touching the cache, the endpoint, or any frontend code.

MockMaterialResearchProvider ships a small hardcoded catalog so the full
pipeline (endpoint, cache, normalization, UI) can be built and demoed with
zero external API cost. It never invents missing data: validate_product_data
downgrades confidence instead of fabricating fields, and a country with no
dedicated catalog entry falls back to a generic "DEFAULT" bucket that is
explicitly flagged as unverified for that country.
"""

import uuid
from abc import ABC, abstractmethod
from datetime import date
from typing import Any, Dict, List, Optional

from .schemas import NormalizedMaterial

TODAY = date(2026, 9, 21).isoformat()


class MaterialResearchProvider(ABC):
    name = "abstract"

    @abstractmethod
    async def search_materials(self, country: str, category: str) -> List[Dict[str, Any]]:
        """Return raw candidate products for a country+category."""

    def extract_product_data(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        return dict(raw)

    def validate_product_data(self, extracted: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        data = dict(extracted)
        if not data.get("sourcePrice") or not data.get("normalizedPrice"):
            return None  # can't recommend a material with no verifiable price
        # Coverage only means anything for materials sold in area-based
        # packages (m2 — flooring tiles, paint buckets...). Volume/weight/
        # discrete-count materials (concrete by the m3, rebar/steel by the
        # kg, doors/windows/tie-columns by the unit) are bought continuously
        # or as one indivisible item — there's no "package" to verify, so a
        # missing coverage there isn't unverified data and must not be
        # penalized as if it were.
        sold_by_area = data.get("normalizedUnit") == "m2"
        if sold_by_area and not data.get("coverage"):
            data["confidence"] = "low" if data.get("confidence") != "high" else "medium"
        return data

    def normalize_product_data(
        self, validated: Dict[str, Any], country: str, category: str
    ) -> NormalizedMaterial:
        return NormalizedMaterial(
            id=validated.get("id") or str(uuid.uuid4()),
            materialName=validated["materialName"],
            category=category,
            country=country,
            currency=validated["currency"],
            sourcePrice=validated["sourcePrice"],
            sourceUnit=validated["sourceUnit"],
            coverage=validated.get("coverage"),
            coverageUnit=validated.get("coverageUnit"),
            normalizedPrice=validated["normalizedPrice"],
            normalizedUnit=validated["normalizedUnit"],
            recommendedWasteFactor=validated.get("recommendedWasteFactor", 0.05),
            sourceName=validated["sourceName"],
            sourceUrl=validated.get("sourceUrl"),
            sourceDate=validated.get("sourceDate") or TODAY,
            confidence=validated.get("confidence", "medium"),
            note=validated.get("note"),
        )

    async def get_recommendations(self, country: str, category: str) -> List[NormalizedMaterial]:
        raw_results = await self.search_materials(country, category)
        out: List[NormalizedMaterial] = []
        for raw in raw_results:
            extracted = self.extract_product_data(raw)
            validated = self.validate_product_data(extracted)
            if validated:
                out.append(self.normalize_product_data(validated, country, category))
        return out[:3]


def _m(**kwargs) -> Dict[str, Any]:
    kwargs.setdefault("sourceDate", TODAY)
    kwargs.setdefault("confidence", "high")
    return kwargs


class MockMaterialResearchProvider(MaterialResearchProvider):
    name = "mock-v1"

    CATALOG: Dict[tuple, List[Dict[str, Any]]] = {
        ("ID", "flooring"): [
            _m(materialName="Granite HT 60x60", currency="IDR", sourcePrice=350000, sourceUnit="box",
               coverage=1.44, coverageUnit="m2/box", normalizedPrice=243055.56, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Sample Building Supply (ID)"),
            _m(materialName="Ceramic Tile 60x60", currency="IDR", sourcePrice=180000, sourceUnit="box",
               coverage=1.44, coverageUnit="m2/box", normalizedPrice=125000.0, normalizedUnit="m2",
               recommendedWasteFactor=0.08, sourceName="Sample Building Supply (ID)"),
        ],
        ("ID", "paint"): [
            _m(materialName="Interior Wall Paint 20L", currency="IDR", sourcePrice=800000, sourceUnit="bucket",
               coverage=200, coverageUnit="m2/bucket", normalizedPrice=4000.0, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Sample Paint Retailer (ID)"),
            _m(materialName="Exterior Weather-Shield Paint 20L", currency="IDR", sourcePrice=1100000, sourceUnit="bucket",
               coverage=180, coverageUnit="m2/bucket", normalizedPrice=6111.11, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Sample Paint Retailer (ID)"),
        ],
        ("ID", "doors"): [
            _m(materialName="Solid Wood Panel Door", currency="IDR", sourcePrice=1800000, sourceUnit="unit",
               normalizedPrice=1800000, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Door & Window Co (ID)"),
            _m(materialName="Engineered Wood Door", currency="IDR", sourcePrice=1200000, sourceUnit="unit",
               normalizedPrice=1200000, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Door & Window Co (ID)"),
        ],
        ("ID", "windows"): [
            _m(materialName="Aluminum Sliding Window", currency="IDR", sourcePrice=950000, sourceUnit="unit",
               normalizedPrice=950000, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Door & Window Co (ID)"),
            _m(materialName="UPVC Casement Window", currency="IDR", sourcePrice=1450000, sourceUnit="unit",
               normalizedPrice=1450000, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Door & Window Co (ID)"),
        ],
        ("ID", "roofing"): [
            _m(materialName="Concrete Roof Tile", currency="IDR", sourcePrice=95000, sourceUnit="m2",
               coverage=1.0, coverageUnit="m2/m2", normalizedPrice=95000, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Sample Building Supply (ID)"),
            _m(materialName="Zinc Metal Roofing Sheet", currency="IDR", sourcePrice=250000, sourceUnit="sheet",
               coverage=2.28, coverageUnit="m2/sheet", normalizedPrice=109649.12, normalizedUnit="m2",
               recommendedWasteFactor=0.08, sourceName="Sample Building Supply (ID)"),
        ],
        ("ID", "staircase"): [
            _m(materialName="Precast Concrete Staircase (per flight)", currency="IDR", sourcePrice=3500000, sourceUnit="unit",
               normalizedPrice=3500000, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Building Supply (ID)"),
            _m(materialName="Timber Staircase (per flight)", currency="IDR", sourcePrice=5500000, sourceUnit="unit",
               normalizedPrice=5500000, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Building Supply (ID)"),
        ],
        ("ID", "railing"): [
            _m(materialName="Stainless Steel Railing (3m section)", currency="IDR", sourcePrice=1800000, sourceUnit="section",
               coverage=3.0, coverageUnit="m/section", normalizedPrice=600000, normalizedUnit="m",
               recommendedWasteFactor=0.05, sourceName="Sample Metal Works (ID)"),
            _m(materialName="Wrought Iron Railing (3m section)", currency="IDR", sourcePrice=1275000, sourceUnit="section",
               coverage=3.0, coverageUnit="m/section", normalizedPrice=425000, normalizedUnit="m",
               recommendedWasteFactor=0.05, sourceName="Sample Metal Works (ID)"),
        ],
        ("ID", "walls"): [
            _m(materialName="Red Clay Brick Wall (built)", currency="IDR", sourcePrice=95000, sourceUnit="m2",
               coverage=1.0, coverageUnit="m2/m2", normalizedPrice=95000, normalizedUnit="m2",
               recommendedWasteFactor=0.08, sourceName="Sample Building Supply (ID)"),
            _m(materialName="Concrete Block Wall (built)", currency="IDR", sourcePrice=75000, sourceUnit="m2",
               coverage=1.0, coverageUnit="m2/m2", normalizedPrice=75000, normalizedUnit="m2",
               recommendedWasteFactor=0.06, sourceName="Sample Building Supply (ID)"),
        ],
        ("ID", "structConcrete"): [
            _m(materialName="Ready-Mix Concrete K-250 (structural)", currency="IDR", sourcePrice=1100000, sourceUnit="m3",
               normalizedPrice=1100000, normalizedUnit="m3", recommendedWasteFactor=0.05,
               sourceName="Sample Ready-Mix Supplier (ID)"),
        ],
        ("ID", "structRebar"): [
            _m(materialName="Reinforcement Steel Rebar", currency="IDR", sourcePrice=15000, sourceUnit="kg",
               normalizedPrice=15000, normalizedUnit="kg", recommendedWasteFactor=0.05,
               sourceName="Sample Steel Supplier (ID)"),
        ],
        ("ID", "structSteel"): [
            _m(materialName="Structural Steel Sections (WF/H-beam)", currency="IDR", sourcePrice=18000, sourceUnit="kg",
               normalizedPrice=18000, normalizedUnit="kg", recommendedWasteFactor=0.03,
               sourceName="Sample Steel Supplier (ID)"),
        ],
        ("ID", "foundation"): [
            _m(materialName="Strip Footing (per linear meter)", currency="IDR", sourcePrice=850000, sourceUnit="m",
               normalizedPrice=850000, normalizedUnit="m", recommendedWasteFactor=0.05,
               sourceName="Sample Building Supply (ID)"),
        ],
        ("ID", "structTieColumn"): [
            _m(materialName="Confined Masonry Tie-Column (per column)", currency="IDR", sourcePrice=650000, sourceUnit="unit",
               normalizedPrice=650000, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Building Supply (ID)"),
        ],
        ("ID", "structRingBeam"): [
            _m(materialName="RC Ring Beam Concrete", currency="IDR", sourcePrice=1150000, sourceUnit="m3",
               normalizedPrice=1150000, normalizedUnit="m3", recommendedWasteFactor=0.05,
               sourceName="Sample Ready-Mix Supplier (ID)"),
        ],
        ("ID", "structFraming"): [
            _m(materialName="Timber Stud Framing Lumber", currency="IDR", sourcePrice=45000, sourceUnit="m",
               normalizedPrice=45000, normalizedUnit="m", recommendedWasteFactor=0.1,
               sourceName="Sample Timber Supplier (ID)"),
        ],
        # Note: sourcePrice/sourceUnit describe the literal retail package
        # (what you'd actually buy, in the US's usual sqft/gallon labeling —
        # kept for transparency), but coverage/normalizedPrice/normalizedUnit
        # are always expressed in m2: the app's canonical unit, since the
        # floor plan itself is drawn in meters. The purchase-math engine
        # does no unit conversion of its own (it's deliberately generic —
        # see purchaseMath.js), so normalization to m2 has to happen here,
        # at the provider boundary, for any country/category whose native
        # retail unit isn't already metric.
        ("US", "flooring"): [
            _m(materialName="Porcelain Tile 24x24in", currency="USD", sourcePrice=68, sourceUnit="box",
               coverage=1.44, coverageUnit="m2/box", normalizedPrice=47.22, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Sample Home Supply (US)"),
            _m(materialName="Luxury Vinyl Plank", currency="USD", sourcePrice=54, sourceUnit="box",
               coverage=2.04, coverageUnit="m2/box", normalizedPrice=26.42, normalizedUnit="m2",
               recommendedWasteFactor=0.08, sourceName="Sample Home Supply (US)"),
        ],
        ("US", "paint"): [
            _m(materialName="Interior Latex Paint 5gal", currency="USD", sourcePrice=140, sourceUnit="bucket",
               coverage=148.64, coverageUnit="m2/bucket", normalizedPrice=0.94, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Sample Paint Supply (US)"),
            _m(materialName="Exterior Acrylic Paint 5gal", currency="USD", sourcePrice=175, sourceUnit="bucket",
               coverage=130.06, coverageUnit="m2/bucket", normalizedPrice=1.35, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Sample Paint Supply (US)"),
        ],
        ("US", "doors"): [
            _m(materialName="Solid Core Interior Door", currency="USD", sourcePrice=220, sourceUnit="unit",
               normalizedPrice=220, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Door & Window Co (US)"),
            _m(materialName="Fiberglass Entry Door", currency="USD", sourcePrice=650, sourceUnit="unit",
               normalizedPrice=650, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Door & Window Co (US)"),
        ],
        ("US", "windows"): [
            _m(materialName="Vinyl Double-Hung Window", currency="USD", sourcePrice=320, sourceUnit="unit",
               normalizedPrice=320, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Door & Window Co (US)"),
            _m(materialName="Fiberglass Casement Window", currency="USD", sourcePrice=480, sourceUnit="unit",
               normalizedPrice=480, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Door & Window Co (US)"),
        ],
        ("US", "roofing"): [
            _m(materialName="Asphalt Shingles (per square)", currency="USD", sourcePrice=110, sourceUnit="square",
               coverage=9.29, coverageUnit="m2/square", normalizedPrice=11.84, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Sample Home Supply (US)"),
            _m(materialName="Standing Seam Metal Roofing (per square)", currency="USD", sourcePrice=450, sourceUnit="square",
               coverage=9.29, coverageUnit="m2/square", normalizedPrice=48.44, normalizedUnit="m2",
               recommendedWasteFactor=0.08, sourceName="Sample Home Supply (US)"),
        ],
        ("US", "staircase"): [
            _m(materialName="Prefab Wood Staircase (per flight)", currency="USD", sourcePrice=1200, sourceUnit="unit",
               normalizedPrice=1200, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Home Supply (US)"),
            _m(materialName="Steel Staircase Kit (per flight)", currency="USD", sourcePrice=2200, sourceUnit="unit",
               normalizedPrice=2200, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Home Supply (US)"),
        ],
        ("US", "railing"): [
            _m(materialName="Aluminum Railing (3m section)", currency="USD", sourcePrice=294, sourceUnit="section",
               coverage=3.0, coverageUnit="m/section", normalizedPrice=98, normalizedUnit="m",
               recommendedWasteFactor=0.05, sourceName="Sample Home Supply (US)"),
            _m(materialName="Wood Railing (3m section)", currency="USD", sourcePrice=229.5, sourceUnit="section",
               coverage=3.0, coverageUnit="m/section", normalizedPrice=76.5, normalizedUnit="m",
               recommendedWasteFactor=0.05, sourceName="Sample Home Supply (US)"),
        ],
        ("US", "walls"): [
            _m(materialName="Brick Veneer Wall (built)", currency="USD", sourcePrice=45, sourceUnit="m2",
               coverage=1.0, coverageUnit="m2/m2", normalizedPrice=45, normalizedUnit="m2",
               recommendedWasteFactor=0.08, sourceName="Sample Home Supply (US)"),
            _m(materialName="Concrete Block Wall (CMU, built)", currency="USD", sourcePrice=38, sourceUnit="m2",
               coverage=1.0, coverageUnit="m2/m2", normalizedPrice=38, normalizedUnit="m2",
               recommendedWasteFactor=0.06, sourceName="Sample Home Supply (US)"),
        ],
        ("US", "structConcrete"): [
            _m(materialName="Ready-Mix Concrete 4000 PSI (structural)", currency="USD", sourcePrice=165, sourceUnit="m3",
               normalizedPrice=165, normalizedUnit="m3", recommendedWasteFactor=0.05,
               sourceName="Sample Ready-Mix Supplier (US)"),
        ],
        ("US", "structRebar"): [
            _m(materialName="Reinforcement Steel Rebar (#4)", currency="USD", sourcePrice=1.10, sourceUnit="kg",
               normalizedPrice=1.10, normalizedUnit="kg", recommendedWasteFactor=0.05,
               sourceName="Sample Steel Supplier (US)"),
        ],
        ("US", "structSteel"): [
            _m(materialName="Structural Steel Sections (W-shape)", currency="USD", sourcePrice=2.20, sourceUnit="kg",
               normalizedPrice=2.20, normalizedUnit="kg", recommendedWasteFactor=0.03,
               sourceName="Sample Steel Supplier (US)"),
        ],
        ("US", "foundation"): [
            _m(materialName="Strip Footing (per linear meter)", currency="USD", sourcePrice=95, sourceUnit="m",
               normalizedPrice=95, normalizedUnit="m", recommendedWasteFactor=0.05,
               sourceName="Sample Home Supply (US)"),
        ],
        ("US", "structTieColumn"): [
            _m(materialName="Confined Masonry Tie-Column (per column)", currency="USD", sourcePrice=95, sourceUnit="unit",
               normalizedPrice=95, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Home Supply (US)"),
        ],
        ("US", "structRingBeam"): [
            _m(materialName="RC Ring Beam Concrete", currency="USD", sourcePrice=175, sourceUnit="m3",
               normalizedPrice=175, normalizedUnit="m3", recommendedWasteFactor=0.05,
               sourceName="Sample Ready-Mix Supplier (US)"),
        ],
        ("US", "structFraming"): [
            _m(materialName="Timber Stud Framing Lumber (2x4)", currency="USD", sourcePrice=3.20, sourceUnit="m",
               normalizedPrice=3.20, normalizedUnit="m", recommendedWasteFactor=0.1,
               sourceName="Sample Home Supply (US)"),
        ],
        ("GB", "flooring"): [
            _m(materialName="Porcelain Tile 60x60cm", currency="GBP", sourcePrice=32, sourceUnit="box",
               coverage=1.44, coverageUnit="m2/box", normalizedPrice=22.22, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Sample Tile Merchant (UK)"),
            _m(materialName="Laminate Flooring Pack", currency="GBP", sourcePrice=24, sourceUnit="pack",
               coverage=2.22, coverageUnit="m2/pack", normalizedPrice=10.81, normalizedUnit="m2",
               recommendedWasteFactor=0.08, sourceName="Sample Tile Merchant (UK)"),
        ],
        ("GB", "paint"): [
            _m(materialName="Interior Emulsion 10L", currency="GBP", sourcePrice=48, sourceUnit="tin",
               coverage=120, coverageUnit="m2/tin", normalizedPrice=0.40, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Sample Paint Merchant (UK)"),
            _m(materialName="Exterior Masonry Paint 10L", currency="GBP", sourcePrice=62, sourceUnit="tin",
               coverage=90, coverageUnit="m2/tin", normalizedPrice=0.69, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Sample Paint Merchant (UK)"),
        ],
        ("GB", "doors"): [
            _m(materialName="Internal Oak Veneer Door", currency="GBP", sourcePrice=95, sourceUnit="unit",
               normalizedPrice=95, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Door & Window Merchant (UK)"),
            _m(materialName="Composite Front Door", currency="GBP", sourcePrice=650, sourceUnit="unit",
               normalizedPrice=650, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Door & Window Merchant (UK)"),
        ],
        ("GB", "windows"): [
            _m(materialName="UPVC Casement Window", currency="GBP", sourcePrice=280, sourceUnit="unit",
               normalizedPrice=280, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Door & Window Merchant (UK)"),
            _m(materialName="Aluminium Sliding Window", currency="GBP", sourcePrice=410, sourceUnit="unit",
               normalizedPrice=410, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Door & Window Merchant (UK)"),
        ],
        ("GB", "roofing"): [
            _m(materialName="Interlocking Concrete Tile", currency="GBP", sourcePrice=38, sourceUnit="m2",
               coverage=1.0, coverageUnit="m2/m2", normalizedPrice=38, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Sample Roofing Merchant (UK)"),
            _m(materialName="Natural Slate", currency="GBP", sourcePrice=95, sourceUnit="m2",
               coverage=1.0, coverageUnit="m2/m2", normalizedPrice=95, normalizedUnit="m2",
               recommendedWasteFactor=0.12, sourceName="Sample Roofing Merchant (UK)"),
        ],
        ("GB", "staircase"): [
            _m(materialName="Precast Concrete Staircase (per flight)", currency="GBP", sourcePrice=950, sourceUnit="unit",
               normalizedPrice=950, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Building Merchant (UK)"),
            _m(materialName="Timber Staircase (per flight)", currency="GBP", sourcePrice=1450, sourceUnit="unit",
               normalizedPrice=1450, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Building Merchant (UK)"),
        ],
        ("GB", "railing"): [
            _m(materialName="Steel Railing (3m section)", currency="GBP", sourcePrice=210, sourceUnit="section",
               coverage=3.0, coverageUnit="m/section", normalizedPrice=70, normalizedUnit="m",
               recommendedWasteFactor=0.05, sourceName="Sample Metal Works (UK)"),
            _m(materialName="Timber Railing (3m section)", currency="GBP", sourcePrice=150, sourceUnit="section",
               coverage=3.0, coverageUnit="m/section", normalizedPrice=50, normalizedUnit="m",
               recommendedWasteFactor=0.05, sourceName="Sample Metal Works (UK)"),
        ],
        ("GB", "walls"): [
            _m(materialName="Facing Brick Wall (built)", currency="GBP", sourcePrice=55, sourceUnit="m2",
               coverage=1.0, coverageUnit="m2/m2", normalizedPrice=55, normalizedUnit="m2",
               recommendedWasteFactor=0.08, sourceName="Sample Building Merchant (UK)"),
            _m(materialName="Concrete Block Wall (built)", currency="GBP", sourcePrice=40, sourceUnit="m2",
               coverage=1.0, coverageUnit="m2/m2", normalizedPrice=40, normalizedUnit="m2",
               recommendedWasteFactor=0.06, sourceName="Sample Building Merchant (UK)"),
        ],
        ("GB", "structConcrete"): [
            _m(materialName="Ready-Mix Concrete C30 (structural)", currency="GBP", sourcePrice=110, sourceUnit="m3",
               normalizedPrice=110, normalizedUnit="m3", recommendedWasteFactor=0.05,
               sourceName="Sample Ready-Mix Supplier (UK)"),
        ],
        ("GB", "structRebar"): [
            _m(materialName="Reinforcement Steel Rebar", currency="GBP", sourcePrice=0.85, sourceUnit="kg",
               normalizedPrice=0.85, normalizedUnit="kg", recommendedWasteFactor=0.05,
               sourceName="Sample Steel Supplier (UK)"),
        ],
        ("GB", "structSteel"): [
            _m(materialName="Structural Steel Sections (UB/UC)", currency="GBP", sourcePrice=1.80, sourceUnit="kg",
               normalizedPrice=1.80, normalizedUnit="kg", recommendedWasteFactor=0.03,
               sourceName="Sample Steel Supplier (UK)"),
        ],
        ("GB", "foundation"): [
            _m(materialName="Strip Footing (per linear meter)", currency="GBP", sourcePrice=75, sourceUnit="m",
               normalizedPrice=75, normalizedUnit="m", recommendedWasteFactor=0.05,
               sourceName="Sample Building Merchant (UK)"),
        ],
        ("GB", "structTieColumn"): [
            _m(materialName="Confined Masonry Tie-Column (per column)", currency="GBP", sourcePrice=80, sourceUnit="unit",
               normalizedPrice=80, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Sample Building Merchant (UK)"),
        ],
        ("GB", "structRingBeam"): [
            _m(materialName="RC Ring Beam Concrete", currency="GBP", sourcePrice=118, sourceUnit="m3",
               normalizedPrice=118, normalizedUnit="m3", recommendedWasteFactor=0.05,
               sourceName="Sample Ready-Mix Supplier (UK)"),
        ],
        ("GB", "structFraming"): [
            _m(materialName="Timber Stud Framing Lumber", currency="GBP", sourcePrice=2.60, sourceUnit="m",
               normalizedPrice=2.60, normalizedUnit="m", recommendedWasteFactor=0.1,
               sourceName="Sample Timber Merchant (UK)"),
        ],
        # Generic fallback used for any country not covered above. Deliberately
        # marked low-confidence — this is reference data, not a local price.
        ("DEFAULT", "flooring"): [
            _m(materialName="Generic Ceramic Tile (reference)", currency="USD", sourcePrice=15, sourceUnit="m2",
               coverage=1.0, coverageUnit="m2/m2", normalizedPrice=15.0, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Generic reference pricing", confidence="low"),
        ],
        ("DEFAULT", "paint"): [
            _m(materialName="Generic Interior Paint (reference)", currency="USD", sourcePrice=40, sourceUnit="gallon",
               coverage=35, coverageUnit="m2/gallon", normalizedPrice=1.14, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Generic reference pricing", confidence="low"),
        ],
        ("DEFAULT", "doors"): [
            _m(materialName="Generic Interior Door (reference)", currency="USD", sourcePrice=200, sourceUnit="unit",
               normalizedPrice=200, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Generic reference pricing", confidence="low"),
        ],
        ("DEFAULT", "windows"): [
            _m(materialName="Generic Window Unit (reference)", currency="USD", sourcePrice=300, sourceUnit="unit",
               normalizedPrice=300, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Generic reference pricing", confidence="low"),
        ],
        ("DEFAULT", "roofing"): [
            _m(materialName="Generic Roofing (reference)", currency="USD", sourcePrice=20, sourceUnit="m2",
               coverage=1.0, coverageUnit="m2/m2", normalizedPrice=20, normalizedUnit="m2",
               recommendedWasteFactor=0.10, sourceName="Generic reference pricing", confidence="low"),
        ],
        ("DEFAULT", "staircase"): [
            _m(materialName="Generic Staircase (reference, per flight)", currency="USD", sourcePrice=1000, sourceUnit="unit",
               normalizedPrice=1000, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Generic reference pricing", confidence="low"),
        ],
        ("DEFAULT", "railing"): [
            _m(materialName="Generic Railing (reference, 3m section)", currency="USD", sourcePrice=180, sourceUnit="section",
               coverage=3.0, coverageUnit="m/section", normalizedPrice=60, normalizedUnit="m",
               recommendedWasteFactor=0.05, sourceName="Generic reference pricing", confidence="low"),
        ],
        ("DEFAULT", "walls"): [
            _m(materialName="Generic Brick Wall (reference)", currency="USD", sourcePrice=40, sourceUnit="m2",
               coverage=1.0, coverageUnit="m2/m2", normalizedPrice=40, normalizedUnit="m2",
               recommendedWasteFactor=0.08, sourceName="Generic reference pricing", confidence="low"),
        ],
        ("DEFAULT", "structConcrete"): [
            _m(materialName="Generic Structural Concrete (reference)", currency="USD", sourcePrice=150, sourceUnit="m3",
               normalizedPrice=150, normalizedUnit="m3", recommendedWasteFactor=0.05,
               sourceName="Generic reference pricing", confidence="low"),
        ],
        ("DEFAULT", "structRebar"): [
            _m(materialName="Generic Reinforcement Rebar (reference)", currency="USD", sourcePrice=1.00, sourceUnit="kg",
               normalizedPrice=1.00, normalizedUnit="kg", recommendedWasteFactor=0.05,
               sourceName="Generic reference pricing", confidence="low"),
        ],
        ("DEFAULT", "structSteel"): [
            _m(materialName="Generic Structural Steel (reference)", currency="USD", sourcePrice=2.00, sourceUnit="kg",
               normalizedPrice=2.00, normalizedUnit="kg", recommendedWasteFactor=0.03,
               sourceName="Generic reference pricing", confidence="low"),
        ],
        ("DEFAULT", "foundation"): [
            _m(materialName="Generic Strip Footing (reference, per linear meter)", currency="USD", sourcePrice=80, sourceUnit="m",
               normalizedPrice=80, normalizedUnit="m", recommendedWasteFactor=0.05,
               sourceName="Generic reference pricing", confidence="low"),
        ],
        ("DEFAULT", "structTieColumn"): [
            _m(materialName="Generic Tie-Column (reference, per column)", currency="USD", sourcePrice=90, sourceUnit="unit",
               normalizedPrice=90, normalizedUnit="unit", recommendedWasteFactor=0,
               sourceName="Generic reference pricing", confidence="low"),
        ],
        ("DEFAULT", "structRingBeam"): [
            _m(materialName="Generic Ring Beam Concrete (reference)", currency="USD", sourcePrice=160, sourceUnit="m3",
               normalizedPrice=160, normalizedUnit="m3", recommendedWasteFactor=0.05,
               sourceName="Generic reference pricing", confidence="low"),
        ],
        ("DEFAULT", "structFraming"): [
            _m(materialName="Generic Timber Framing Lumber (reference)", currency="USD", sourcePrice=3.00, sourceUnit="m",
               normalizedPrice=3.00, normalizedUnit="m", recommendedWasteFactor=0.1,
               sourceName="Generic reference pricing", confidence="low"),
        ],
    }

    FALLBACK_NOTE = "Generic reference data — not verified for this country yet."

    async def search_materials(self, country: str, category: str) -> List[Dict[str, Any]]:
        key = (country.upper(), category)
        if key in self.CATALOG:
            return [dict(item) for item in self.CATALOG[key]]
        fallback = self.CATALOG.get(("DEFAULT", category), [])
        return [dict(item, note=self.FALLBACK_NOTE) for item in fallback]
