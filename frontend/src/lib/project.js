import { DEFAULT_ITEMS, DEFAULT_RESOURCES } from "./constructionItems";

const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id_" + Math.random().toString(36).slice(2));

export function makeFloor(level, name, height = 3.2) {
  return {
    id: uid(),
    level,
    name: name || `Floor ${level + 1}`,
    height,
    walls: [],
    doors: [],
    windows: [],
    columns: [],
    utilities: [],
    roomNames: {}, // roomKey -> { name, ceilingHeight }
  };
}

export function newProject(info = {}) {
  const floorCount = info.floorCount || 1;
  const floors = [];
  for (let i = 0; i < floorCount; i++) {
    floors.push(makeFloor(i, i === 0 ? "Ground Floor" : `Floor ${i + 1}`));
  }
  return {
    id: uid(),
    name: info.name || "Untitled Project",
    client: info.client || "",
    location: info.location || "",
    buildingType: info.buildingType || "Residential House",
    land: info.land || { length: 0, width: 0 },
    building: info.building || { length: 0, width: 0 },
    floorCount,
    currency: info.currency || "USD",
    overheadPct: 10,
    floors,
    itemsDb: JSON.parse(JSON.stringify(DEFAULT_ITEMS)),
    resourcesDb: JSON.parse(JSON.stringify(DEFAULT_RESOURCES)),
    estimatedCost: 0,
    buildingArea: 0,
  };
}

// Build a rectangular room of walls between corners (list of {x,y}), closed loop.
function rectWalls(x0, y0, x1, y1, opts = {}) {
  const pts = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  const walls = [];
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    walls.push({
      id: uid(),
      start: { ...pts[i] },
      end: { ...pts[j] },
      thickness: opts.thickness || 0.15,
      height: opts.height || 3.2,
      material: "brick",
      wallType: opts.wallType || "exterior",
    });
  }
  return walls;
}

function segment(a, b, opts = {}) {
  return {
    id: uid(),
    start: { ...a },
    end: { ...b },
    thickness: opts.thickness || 0.1,
    height: opts.height || 3.2,
    material: "brick",
    wallType: opts.wallType || "interior",
  };
}

// A ready-to-use starter house so users can immediately test the planner + RAB.
export function starterHouse() {
  const p = newProject({
    name: "Modern 3-Bedroom Family House",
    client: "Sample Client",
    location: "—",
    building: { length: 12, width: 8 },
    land: { length: 15, width: 10 },
    floorCount: 1,
  });
  const f = p.floors[0];
  // outer shell 12 x 8
  const outer = rectWalls(0, 0, 12, 8, { thickness: 0.2, wallType: "exterior" });
  // interior partitions
  const inner = [
    segment({ x: 5, y: 0 }, { x: 5, y: 5 }), // vertical split
    segment({ x: 0, y: 5 }, { x: 5, y: 5 }), // horizontal left
    segment({ x: 5, y: 3 }, { x: 12, y: 3 }), // horizontal right
    segment({ x: 8.5, y: 3 }, { x: 8.5, y: 8 }), // vertical right
  ];
  f.walls = [...outer, ...inner];

  // a couple of openings on outer walls
  f.doors = [
    { id: uid(), wallId: outer[0].id, t: 0.4, width: 0.9, height: 2.1, type: "single", material: "wood" },
  ];
  f.windows = [
    { id: uid(), wallId: outer[2].id, t: 0.3, width: 1.2, height: 1.5, sill: 0.9, type: "sliding", material: "aluminum" },
    { id: uid(), wallId: outer[1].id, t: 0.5, width: 1.2, height: 1.5, sill: 0.9, type: "sliding", material: "aluminum" },
  ];
  f.columns = [
    { id: uid(), x: 0, y: 0, width: 0.2, depth: 0.2, height: 3.2 },
    { id: uid(), x: 12, y: 0, width: 0.2, depth: 0.2, height: 3.2 },
    { id: uid(), x: 12, y: 8, width: 0.2, depth: 0.2, height: 3.2 },
    { id: uid(), x: 0, y: 8, width: 0.2, depth: 0.2, height: 3.2 },
  ];
  f.utilities = [
    { id: uid(), kind: "lamp", x: 2.5, y: 2.5 },
    { id: uid(), kind: "lamp", x: 8, y: 1.5 },
    { id: uid(), kind: "outlet", x: 1, y: 4.5 },
    { id: uid(), kind: "toilet", x: 10.5, y: 5.5 },
    { id: uid(), kind: "sink", x: 6, y: 4 },
  ];
  return p;
}

export const uidGen = uid;
