import { detectCountry, currencyForCountry } from "./countries";

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
    customItems: [],
    stairs: [],
    railings: [],
    roomNames: {}, // roomKey -> { name, ceilingHeight }
  };
}

export function newProject(info = {}) {
  const floorCount = info.floorCount || 1;
  const floors = [];
  for (let i = 0; i < floorCount; i++) {
    floors.push(makeFloor(i, i === 0 ? "Ground Floor" : `Floor ${i + 1}`));
  }
  // Currency is derived from country, not picked independently: the estimate
  // sums material prices in whatever currency the selected materials came
  // in, with no conversion step yet (that's explicitly future work), so the
  // display currency must match the country's currency or totals would be
  // mislabeled (e.g. a rupiah amount shown with a "$" sign).
  const country = info.country || detectCountry();
  return {
    id: uid(),
    name: info.name || "Untitled Project",
    client: info.client || "",
    location: info.location || "",
    buildingType: info.buildingType || "Residential House",
    land: info.land || { length: 0, width: 0 },
    building: info.building || { length: 0, width: 0 },
    floorCount,
    country,
    currency: info.currency || currencyForCountry(country),
    estimateSettings: { overheadPct: info.overheadPct ?? 10 },
    // Roof shape/pitch/overhang — pitch and overhang feed the RAB volumes
    // ANG/OV in lib/rabInputs.js.
    // A uniform pitch is a reasonable default for any of the four roof
    // types; the type mainly changes the default waste factor there.
    roof: info.roof || { type: "gable", pitchDeg: 30, overhang: 0.5 },
    // Kept for existing projects; the Buildora RAB templates assume a
    // reinforced-concrete frame with masonry infill.
    structuralSystem: info.structuralSystem || "concrete",
    floors,
    materialSelections: {},
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

function door(wallId, t, opts = {}) {
  return { id: uid(), wallId, t, width: opts.width ?? 0.9, height: opts.height ?? 2.1, type: "single", material: "wood" };
}
function win(wallId, t, opts = {}) {
  return { id: uid(), wallId, t, width: opts.width ?? 1.2, height: opts.height ?? 1.5, sill: opts.sill ?? 0.9, type: "sliding", material: "aluminum" };
}
function corner(x, y) {
  return { id: uid(), x, y, width: 0.2, depth: 0.2, height: 3.2 };
}
function util(kind, x, y) {
  return { id: uid(), kind, x, y };
}
function stairAt(x, y, opts = {}) {
  return { id: uid(), x, y, width: opts.width ?? 1.6, depth: opts.depth ?? 2.6, steps: opts.steps ?? 14 };
}
function railingSeg(a, b, opts = {}) {
  return { id: uid(), start: { ...a }, end: { ...b }, height: opts.height ?? 0.9 };
}

// ---- Standard house templates ----
// Simple, functional rectangular-partition layouts (same style as the
// original single starter house) sized to fit their own building footprint,
// which also becomes that project's hard editable-space limit (see
// CanvasWorkspace.jsx). Not architecturally elaborate — a reasonable,
// editable starting point matching the stated bedroom/bathroom count.

function buildStudio() {
  const p = newProject({
    name: "Studio Home", client: "Sample Client", location: "—",
    building: { length: 8, width: 6 }, land: { length: 11, width: 9 }, floorCount: 1,
  });
  const f = p.floors[0];
  const outer = rectWalls(0, 0, 8, 6, { thickness: 0.2, wallType: "exterior" });
  const div1 = segment({ x: 6, y: 0 }, { x: 6, y: 6 }); // bathroom+nook split from living
  const div2 = segment({ x: 6, y: 2 }, { x: 8, y: 2 }); // bathroom / sleep nook split
  f.walls = [...outer, div1, div2];
  f.doors = [door(outer[0].id, 0.15), door(div1.id, 1 / 6), door(div1.id, 4 / 6)];
  f.windows = [win(outer[2].id, 0.4), win(outer[3].id, 0.5)];
  f.columns = [corner(0, 0), corner(8, 0), corner(8, 6), corner(0, 6)];
  f.utilities = [util("lamp", 3, 3), util("lamp", 1.5, 1), util("outlet", 1, 4.5), util("toilet", 7, 0.7), util("sink", 7.5, 1.6)];
  return p;
}

function build2Bed1Bath() {
  const p = newProject({
    name: "2 Bedroom Home", client: "Sample Client", location: "—",
    building: { length: 9, width: 7 }, land: { length: 12, width: 10 }, floorCount: 1,
  });
  const f = p.floors[0];
  const outer = rectWalls(0, 0, 9, 7, { thickness: 0.2, wallType: "exterior" });
  const v1 = segment({ x: 5.5, y: 0 }, { x: 5.5, y: 7 });
  const h1 = segment({ x: 5.5, y: 2.5 }, { x: 9, y: 2.5 });
  const h2 = segment({ x: 5.5, y: 4.5 }, { x: 9, y: 4.5 });
  f.walls = [...outer, v1, h1, h2];
  f.doors = [door(outer[0].id, 0.2), door(v1.id, 1.25 / 7), door(v1.id, 3.5 / 7), door(v1.id, 5.75 / 7)];
  f.windows = [win(outer[1].id, 1.25 / 7), win(outer[1].id, 5.75 / 7), win(outer[2].id, 0.3)];
  f.columns = [corner(0, 0), corner(9, 0), corner(9, 7), corner(0, 7)];
  f.utilities = [
    util("lamp", 2.5, 3.5), util("lamp", 7, 1.25), util("outlet", 1, 1),
    util("toilet", 7, 3.4), util("sink", 6, 3.4), util("sink", 3, 6),
  ];
  return p;
}

function build3Bed2Bath1Level() {
  const p = newProject({
    name: "Modern 3-Bedroom Family House", client: "Sample Client", location: "—",
    building: { length: 12, width: 8 }, land: { length: 15, width: 10 }, floorCount: 1,
  });
  const f = p.floors[0];
  const outer = rectWalls(0, 0, 12, 8, { thickness: 0.2, wallType: "exterior" });
  const inner = [
    segment({ x: 5, y: 0 }, { x: 5, y: 5 }),
    segment({ x: 0, y: 5 }, { x: 5, y: 5 }),
    segment({ x: 5, y: 3 }, { x: 12, y: 3 }),
    segment({ x: 8.5, y: 3 }, { x: 8.5, y: 8 }),
  ];
  f.walls = [...outer, ...inner];
  f.doors = [door(outer[0].id, 0.4)];
  f.windows = [win(outer[2].id, 0.3), win(outer[1].id, 0.5)];
  f.columns = [corner(0, 0), corner(12, 0), corner(12, 8), corner(0, 8)];
  f.utilities = [
    util("lamp", 2.5, 2.5), util("lamp", 8, 1.5), util("outlet", 1, 4.5),
    util("toilet", 10.5, 5.5), util("sink", 6, 4),
    util("toilet", 10.5, 1.5), util("sink", 9.5, 1.5), // 2nd bathroom
  ];
  return p;
}

function build3Bed2Bath2Level() {
  const p = newProject({
    name: "3-Bedroom Two-Storey House", client: "Sample Client", location: "—",
    building: { length: 10, width: 7 }, land: { length: 13, width: 10 }, floorCount: 2,
  });
  const [f0, f1] = p.floors;

  // Ground floor: living/kitchen + guest bath + stairwell
  const outer0 = rectWalls(0, 0, 10, 7, { thickness: 0.2, wallType: "exterior" });
  const g1 = segment({ x: 8, y: 0 }, { x: 8, y: 7 });
  const g2 = segment({ x: 8, y: 3 }, { x: 10, y: 3 });
  const g3 = segment({ x: 8, y: 5 }, { x: 10, y: 5 });
  f0.walls = [...outer0, g1, g2, g3];
  f0.doors = [door(outer0[0].id, 0.3), door(g1.id, 1.5 / 7), door(g1.id, 4 / 7)];
  f0.windows = [win(outer0[2].id, 0.3), win(outer0[2].id, 0.7)];
  f0.columns = [corner(0, 0), corner(10, 0), corner(10, 7), corner(0, 7)];
  f0.stairs = [stairAt(9, 1.5)];
  f0.railings = [railingSeg({ x: 7.8, y: 0 }, { x: 7.8, y: 3 })];
  f0.utilities = [
    util("toilet", 9, 4.3), util("sink", 8.5, 3.6), util("sink", 3, 1),
    util("lamp", 4, 4), util("lamp", 2, 2), util("outlet", 1, 5),
  ];

  // Upper floor: 3 bedrooms + 1 bath + landing over the stairwell
  const outer1 = rectWalls(0, 0, 10, 7, { thickness: 0.2, wallType: "exterior" });
  const u1 = segment({ x: 4, y: 0 }, { x: 4, y: 7 });
  const u2 = segment({ x: 8, y: 0 }, { x: 8, y: 7 });
  const u3 = segment({ x: 0, y: 3.5 }, { x: 8, y: 3.5 });
  const u4 = segment({ x: 6, y: 3.5 }, { x: 6, y: 7 });
  f1.walls = [...outer1, u1, u2, u3, u4];
  f1.doors = [
    door(u3.id, 2 / 8), // BR1 <-> BR3
    door(u3.id, 6 / 8), // BR2 <-> Hall
    door(u1.id, 5.25 / 7), // BR3 <-> Bath
    door(u4.id, (5.25 - 3.5) / 3.5), // Bath <-> Hall
    door(u2.id, 5.25 / 7), // Hall <-> Landing
  ];
  f1.windows = [win(outer1[2].id, 0.2), win(outer1[2].id, 0.55), win(outer1[3].id, 0.75)];
  f1.columns = [corner(0, 0), corner(10, 0), corner(10, 7), corner(0, 7)];
  f1.utilities = [util("toilet", 5, 6.5), util("sink", 4.5, 4), util("lamp", 2, 1.75), util("lamp", 6, 1.75), util("outlet", 9, 6)];

  return p;
}

function build4Bed3Bath2Level() {
  const p = newProject({
    name: "4-Bedroom Two-Storey House", client: "Sample Client", location: "—",
    building: { length: 11, width: 8 }, land: { length: 14, width: 11 }, floorCount: 2,
  });
  const [f0, f1] = p.floors;

  // Ground floor: living/kitchen/dining + guest bath + stairwell
  const outer0 = rectWalls(0, 0, 11, 8, { thickness: 0.2, wallType: "exterior" });
  const g1 = segment({ x: 9, y: 0 }, { x: 9, y: 8 });
  const g2 = segment({ x: 9, y: 3 }, { x: 11, y: 3 });
  const g3 = segment({ x: 9, y: 5 }, { x: 11, y: 5 });
  f0.walls = [...outer0, g1, g2, g3];
  f0.doors = [door(outer0[0].id, 0.25), door(g1.id, 1.5 / 8), door(g1.id, 4 / 8)];
  f0.windows = [win(outer0[2].id, 0.25), win(outer0[2].id, 0.6)];
  f0.columns = [corner(0, 0), corner(11, 0), corner(11, 8), corner(0, 8)];
  f0.stairs = [stairAt(10, 1.5)];
  f0.railings = [railingSeg({ x: 8.8, y: 0 }, { x: 8.8, y: 3 })];
  f0.utilities = [
    util("toilet", 10, 4.3), util("sink", 9.5, 3.6), util("sink", 3, 1),
    util("lamp", 4, 4), util("lamp", 2, 2), util("outlet", 1, 5),
  ];

  // Upper floor: 4 bedrooms + 2 ensuite-style baths either side of a central corridor
  const outer1 = rectWalls(0, 0, 11, 8, { thickness: 0.2, wallType: "exterior" });
  const c1 = segment({ x: 0, y: 3.5 }, { x: 11, y: 3.5 });
  const c2 = segment({ x: 0, y: 4.5 }, { x: 11, y: 4.5 });
  const v1 = segment({ x: 5.5, y: 0 }, { x: 5.5, y: 3.5 });
  const v2 = segment({ x: 9, y: 0 }, { x: 9, y: 3.5 });
  const v3 = segment({ x: 5.5, y: 4.5 }, { x: 5.5, y: 8 });
  const v4 = segment({ x: 9, y: 4.5 }, { x: 9, y: 8 });
  f1.walls = [...outer1, c1, c2, v1, v2, v3, v4];
  f1.doors = [
    door(c1.id, 2.75 / 11), door(c1.id, 7.25 / 11), door(c1.id, 10 / 11),
    door(c2.id, 2.75 / 11), door(c2.id, 7.25 / 11), door(c2.id, 10 / 11),
  ];
  f1.windows = [win(outer1[3].id, 1.75 / 8), win(outer1[3].id, 6.25 / 8), win(outer1[0].id, 7.25 / 11), win(outer1[2].id, 7.25 / 11)];
  f1.columns = [corner(0, 0), corner(11, 0), corner(11, 8), corner(0, 8)];
  f1.utilities = [
    util("toilet", 10, 1.75), util("sink", 9.5, 1),
    util("toilet", 10, 6.25), util("sink", 9.5, 6.75),
    util("lamp", 5.5, 4), util("lamp", 3, 6), util("outlet", 3, 2),
  ];

  return p;
}

export const HOUSE_TEMPLATES = [
  { id: "studio", label: "Studio / 1 Bed, 1 Bath", description: "1 level · ~48 m²", floorCount: 1, build: buildStudio },
  { id: "2b1b", label: "2 Bed, 1 Bath", description: "1 level · ~63 m²", floorCount: 1, build: build2Bed1Bath },
  { id: "3b2b-1l", label: "3 Bed, 2 Bath", description: "1 level · ~96 m²", floorCount: 1, build: build3Bed2Bath1Level },
  { id: "3b2b-2l", label: "3 Bed, 2 Bath", description: "2 levels · ~140 m²", floorCount: 2, build: build3Bed2Bath2Level },
  { id: "4b3b-2l", label: "4 Bed, 3 Bath", description: "2 levels · ~176 m²", floorCount: 2, build: build4Bed3Bath2Level },
];

// Kept as an alias for backward compatibility with anything still calling it
// directly — equivalent to the "3 Bed, 2 Bath (1 level)" template.
export const starterHouse = build3Bed2Bath1Level;

export const uidGen = uid;
