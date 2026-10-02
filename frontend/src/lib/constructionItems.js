// Utility-tool definitions for the planner. Costing lives in the Buildora RAB
// engine (backend/engine), fed from the drawing by lib/rabInputs.js.

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
