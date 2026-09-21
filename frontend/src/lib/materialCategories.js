// Standard construction categories the material-recommendation feature
// covers. Each maps directly onto an existing quantityEngine.js rule id, so
// no geometry/quantity code needs to change to support a new one. Expand
// later (ceiling, cement, bricks, electrical, plumbing) by adding entries
// here — nothing else needs to know.
export const MATERIAL_CATEGORIES = {
  walls: { label: "Walls", rule: "wallArea", unit: "m2", defaultWasteFactor: 0.08 },
  flooring: { label: "Flooring", rule: "floorArea", unit: "m2", defaultWasteFactor: 0.1 },
  paint: { label: "Wall Paint", rule: "paintArea", unit: "m2", defaultWasteFactor: 0.1 },
  doors: { label: "Doors", rule: "doorCount", unit: "unit", defaultWasteFactor: 0 },
  windows: { label: "Windows", rule: "windowCount", unit: "unit", defaultWasteFactor: 0 },
  roofing: { label: "Roofing", rule: "roofArea", unit: "m2", defaultWasteFactor: 0.1 },
  staircase: { label: "Staircase", rule: "stairCount", unit: "unit", defaultWasteFactor: 0 },
  railing: { label: "Railing", rule: "railingLength", unit: "m", defaultWasteFactor: 0.05 },
  // Structural categories — which ones are active depends on project.structuralSystem
  // (see getStructuralCategories below). Each system's figure is a quantity-surveying
  // quick-estimate coefficient, not a placed structural design — see quantityEngine.js.
  structConcrete: { label: "Structural Concrete", rule: "structuralConcreteVolume", unit: "m3", defaultWasteFactor: 0.05 },
  structRebar: { label: "Reinforcement Steel", rule: "structuralRebarWeight", unit: "kg", defaultWasteFactor: 0.05 },
  structSteel: { label: "Structural Steel", rule: "structuralSteelWeight", unit: "kg", defaultWasteFactor: 0.03 },
  foundation: { label: "Foundation", rule: "foundationLength", unit: "m", defaultWasteFactor: 0.05 },
  structTieColumn: { label: "Tie-Columns", rule: "tieColumnCount", unit: "unit", defaultWasteFactor: 0 },
  structRingBeam: { label: "Ring Beam", rule: "beamVolume", unit: "m3", defaultWasteFactor: 0.05 },
  structFraming: { label: "Timber Framing", rule: "timberFramingLength", unit: "m", defaultWasteFactor: 0.1 },
};

// Base categories available regardless of structural system.
export const MATERIAL_CATEGORY_ORDER = ["walls", "flooring", "paint", "doors", "windows", "roofing", "staircase", "railing"];

// Which structural categories are active for a given system. Concrete/steel
// each give one lumped quantity that already includes columns+beams+footing
// (concrete) or the full frame (steel), so no separate foundation/ring-beam
// category is added for those two — that would double-count. Masonry and
// timber don't have a single lumped figure, so their footing is priced
// separately via the existing `foundation` category.
const STRUCTURAL_CATEGORIES_BY_SYSTEM = {
  concrete: ["structConcrete", "structRebar"],
  steel: ["structSteel"],
  masonry: ["foundation", "structTieColumn", "structRingBeam"],
  timber: ["foundation", "structFraming"],
};

export function getStructuralCategories(system) {
  return STRUCTURAL_CATEGORIES_BY_SYSTEM[system] || STRUCTURAL_CATEGORIES_BY_SYSTEM.concrete;
}

// Full active category list for a project: base categories + whichever
// structural set its chosen system activates. Use this (not the static
// MATERIAL_CATEGORY_ORDER alone) anywhere the full working set is needed.
export function getActiveCategoryOrder(project) {
  return [...MATERIAL_CATEGORY_ORDER, ...getStructuralCategories(project?.structuralSystem)];
}

export const STRUCTURAL_SYSTEMS = [
  { id: "concrete", label: "Concrete Frame", blurb: "Includes: structural concrete, reinforcement steel" },
  { id: "steel", label: "Steel Frame", blurb: "Includes: structural steel" },
  { id: "masonry", label: "Masonry (Load-Bearing)", blurb: "Includes: foundation, tie-columns, ring beam" },
  { id: "timber", label: "Timber Frame", blurb: "Includes: foundation, timber framing" },
];

// Roof waste depends on the roof shape (more hip/valley cuts -> more offcuts),
// not on which material was picked — kept separate from MATERIAL_CATEGORIES'
// static defaultWasteFactor since it depends on live project.roof state.
const ROOF_WASTE_BY_TYPE = { flat: 0.05, shed: 0.08, gable: 0.1, hip: 0.15 };
export function roofWasteFactor(type) {
  return ROOF_WASTE_BY_TYPE[type] ?? 0.1;
}
