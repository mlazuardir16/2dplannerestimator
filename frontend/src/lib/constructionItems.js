// Category display metadata and utility-tool definitions. The old
// AHSP-style DEFAULT_ITEMS/DEFAULT_RESOURCES coefficient tables have been
// replaced by the country-aware material recommendation feature — see
// lib/materialCategories.js, lib/purchaseMath.js, lib/estimateEngine.js.

export const CATEGORY_META = {
  flooring: { label: "Flooring", color: "#1E56A0" },
  paint: { label: "Wall Paint", color: "#0D9488" },
  doors: { label: "Doors", color: "#D97706" },
  windows: { label: "Windows", color: "#6366F1" },
  roofing: { label: "Roofing", color: "#B45309" },
  staircase: { label: "Staircase", color: "#7C3AED" },
  railing: { label: "Railing", color: "#0F766E" },
  custom: { label: "Custom Items", color: "#78716C" },
  // Structural categories share a slate/stone family so they read as one
  // visual group in the BOQ/Cost Summary, distinct from the finish categories.
  walls: { label: "Walls", color: "#475569" },
  structConcrete: { label: "Structural Concrete", color: "#57534E" },
  structRebar: { label: "Reinforcement Steel", color: "#71717A" },
  structSteel: { label: "Structural Steel", color: "#52525B" },
  foundation: { label: "Foundation", color: "#44403C" },
  structTieColumn: { label: "Tie-Columns", color: "#64748B" },
  structRingBeam: { label: "Ring Beam", color: "#334155" },
  structFraming: { label: "Timber Framing", color: "#92400E" },
};

export const UTILITY_KINDS = [
  { id: "lamp", label: "Lamp", category: "electrical" },
  { id: "switch", label: "Switch", category: "electrical" },
  { id: "outlet", label: "Power Outlet", category: "electrical" },
  { id: "toilet", label: "Toilet", category: "plumbing" },
  { id: "shower", label: "Shower", category: "plumbing" },
  { id: "sink", label: "Sink", category: "plumbing" },
  { id: "drain", label: "Floor Drain", category: "plumbing" },
  { id: "gate", label: "Gate", category: "exterior" },
];
