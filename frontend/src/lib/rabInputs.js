import { wallLength, boundingBox } from "./geometry";

// Drawing -> Buildora RAB request.
//
// The drawing supplies what it can measure (dimensions, wall lengths,
// openings, columns, fixtures, stairs); everything else keeps the template's
// default. A value the user typed in the Input/RAB tabs always wins.
// Precedence: manual > denah (drawing) > template.
//
// Rule of thumb for "can the drawing measure it": geometry (W, D, heights,
// interior walls) comes from the drawing as soon as walls exist; counts
// (openings, columns, fixtures, stairs) only once at least one such element
// is drawn — an empty count means "not drawn yet", not "zero".

export const RAB_TEMPLATE_BY_FLOORS = { 1: "tipe36_1lantai", 2: "2lantai_lb108" };

export const SOURCE = { manual: "manual", drawing: "denah", template: "template" };

// Per-unit allowances taken from the 2-lantai template (KM1, KMW1, WPF, TG,
// TGF) so that one drawn toilet/stair adds what the template assumes for one.
const PER_BATHROOM = { floor: 3, wallTiles: 15.4, waterproofing: 4.5, boven: 0.2 };
const PER_STAIR = { concrete: 1.6, granite: 10 };
const MAIN_COLUMN_MIN_SIZE = 0.2; // m — 20×20 main column vs 15×15 kolom praktis

export function templateForProject(project) {
  return RAB_TEMPLATE_BY_FLOORS[(project?.floors || []).length] || null;
}

const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);

function floorStats(floor) {
  const walls = (floor.walls || []).filter((w) => w.wallType !== "fence");
  const wallIds = new Set(walls.map((w) => w.id));
  const exterior = walls.filter((w) => w.wallType !== "interior");
  const interior = walls.filter((w) => w.wallType === "interior");
  const doors = (floor.doors || []).filter((d) => wallIds.has(d.wallId));
  const windows = (floor.windows || []).filter((w) => wallIds.has(w.wallId));
  const openings = [...doors, ...windows];
  const columns = floor.columns || [];
  const utilities = floor.utilities || [];
  const count = (kind) => utilities.filter((u) => u.kind === kind).length;
  const stairs = floor.stairs || [];

  return {
    hasWalls: walls.length > 0,
    bbox: boundingBox(exterior.length ? exterior : walls),
    height: floor.height || 3.2,
    totalWallLength: sum(walls, wallLength),
    interiorLength: sum(interior, wallLength),
    openingArea: sum(openings, (o) => (o.width || 0) * (o.height || 0)),
    openingWidth: sum(openings, (o) => o.width || 0),
    openingCount: openings.length,
    doorCount: doors.length,
    windowCount: windows.length,
    windowArea: sum(windows, (w) => (w.width || 0) * (w.height || 0)),
    mainColumns: columns.filter((c) => Math.min(c.width || 0, c.depth || 0) >= MAIN_COLUMN_MIN_SIZE).length,
    practicalColumns: columns.filter((c) => Math.min(c.width || 0, c.depth || 0) < MAIN_COLUMN_MIN_SIZE).length,
    columnCount: columns.length,
    stairCount: stairs.length,
    stairArea: sum(stairs, (s) => (s.width || 0) * (s.depth || 0)),
    railingLength: sum(floor.railings || [], (r) => wallLength(r)),
    toilets: count("toilet"),
    showers: count("shower"),
    sinks: count("sink"),
    drains: count("drain"),
    lamps: count("lamp"),
    switchesAndOutlets: count("switch") + count("outlet"),
  };
}

// Volume inputs the drawing can supply, by template key.
function drawingVolumes(project, template, stats) {
  const v = {};
  const [f0, f1] = stats;
  const total = (k) => sum(stats, (s) => s[k]);
  const put = (key, value, when = true) => {
    if (when && Number.isFinite(value)) v[key] = round(value);
  };

  if (f0?.hasWalls && f0.bbox) {
    put("W", Math.min(f0.bbox.width, f0.bbox.height));
    put("D", Math.max(f0.bbox.width, f0.bbox.height));
  }
  const roof = project?.roof;
  if (roof) {
    put("ANG", roof.type === "flat" ? 0 : roof.pitchDeg ?? 30);
    put("OV", roof.overhang ?? 0.5);
  }
  if ((project?.land?.width || 0) > 0) put("PG", project.land.width);

  const toilets = total("toilets");
  if (template === "tipe36_1lantai") {
    put("H", f0.height, f0.hasWalls);
    put("LI", f0.interiorLength, f0.hasWalls);
    put("OP", f0.openingArea, f0.openingCount > 0);
    put("OPW", f0.openingWidth, f0.openingCount > 0);
    put("NB", f0.openingCount, f0.openingCount > 0);
    put("NK", f0.columnCount, f0.columnCount > 0);
    put("KM", toilets * PER_BATHROOM.floor, toilets > 0);
    put("KMW", toilets * PER_BATHROOM.wallTiles, toilets > 0);
  } else if (template === "2lantai_lb108") {
    put("H1", f0.height, f0.hasWalls);
    put("H2", f1.height, f1.hasWalls);
    put("LI1", f0.interiorLength, f0.hasWalls);
    put("LI2", f1.interiorLength, f1.hasWalls);
    put("OP1", f0.openingArea, f0.openingCount > 0);
    put("OP2", f1.openingArea, f1.openingCount > 0);
    put("OPW", total("openingWidth"), total("openingCount") > 0);
    put("NB", total("openingCount"), total("openingCount") > 0);
    put("NK", f0.mainColumns, f0.mainColumns > 0);
    put("NF", f0.mainColumns, f0.mainColumns > 0);
    put("NKP1", f0.practicalColumns, f0.practicalColumns > 0);
    put("NKP2", f1.practicalColumns, f1.practicalColumns > 0);
    // Floor beams run over the ground-floor wall lines.
    put("BLEN", f0.totalWallLength, f0.hasWalls);
    const stairs = total("stairCount");
    put("VOID", f0.stairArea, stairs > 0);
    put("TG", stairs * PER_STAIR.concrete, stairs > 0);
    put("TGF", stairs * PER_STAIR.granite, stairs > 0);
    put("RLT", total("railingLength"), total("railingLength") > 0);
    put("NKM", toilets, toilets > 0);
    put("WPF", f1.toilets * PER_BATHROOM.waterproofing, toilets > 0);
  }
  return v;
}

// Fixed-number item volumes the drawing can supply, matched by item-name prefix
// (names are shared by both templates).
function drawingItemVolumes(items, stats) {
  const total = (k) => sum(stats, (s) => s[k]);
  const doors = total("doorCount");
  const toilets = total("toilets");
  const bathroomDoors = Math.min(toilets, Math.max(0, doors - 1));
  const rules = [
    ["Pintu utama aluminium", 1, doors > 0],
    ["Pintu kamar HPL", Math.max(0, doors - 1 - bathroomDoors), doors > 0],
    ["Pintu KM PVC", bathroomDoors, doors > 0 && toilets > 0],
    ["Jendela aluminium + kaca", total("windowArea"), total("windowCount") > 0],
    ["Bovenlight KM", toilets * PER_BATHROOM.boven, toilets > 0],
    ["Kloset duduk", toilets, toilets > 0],
    ["Shower set", total("showers"), total("showers") > 0],
    ["Wastafel + kran", total("sinks"), total("sinks") > 0],
    ["Floor drain", total("drains"), total("drains") > 0],
    ["Titik lampu", total("lamps"), total("lamps") > 0],
    ["Titik saklar / stop kontak", total("switchesAndOutlets"), total("switchesAndOutlets") > 0],
  ];
  const out = {};
  for (const item of items) {
    if (item.volume_key) continue; // follows a volume key, not a fixed number
    const rule = rules.find(([prefix]) => item.name.startsWith(prefix));
    if (rule && rule[2]) out[item.code] = round(rule[1]);
  }
  return out;
}

function round(x) {
  return Math.round(x * 1e4) / 1e4;
}

// Builds the POST /api/rab/calculate body plus where each value came from.
// Returns null when the project's floor count has no Buildora template.
export function buildRabRequest(project, catalog) {
  const template = templateForProject(project);
  const tpl = catalog?.templates?.find((t) => t.key === template);
  if (!tpl) return null;

  const stats = (project.floors || []).map(floorStats);
  const rab = project.rab || {};
  const manualVolumes = rab.volumes?.[template] || {};
  const manualItems = rab.itemVolumes?.[template] || {};

  const fromDrawing = drawingVolumes(project, template, stats);
  const itemsFromDrawing = drawingItemVolumes(tpl.items, stats);

  const volumes = {};
  const volumeSources = {};
  for (const v of tpl.volumes.filter((x) => x.input)) {
    if (manualVolumes[v.key] != null) {
      volumes[v.key] = manualVolumes[v.key];
      volumeSources[v.key] = SOURCE.manual;
    } else if (fromDrawing[v.key] != null) {
      volumes[v.key] = fromDrawing[v.key];
      volumeSources[v.key] = SOURCE.drawing;
    } else {
      volumeSources[v.key] = SOURCE.template;
    }
  }

  const itemVolumes = {};
  const itemSources = {};
  for (const item of tpl.items.filter((i) => !i.volume_key)) {
    if (manualItems[item.code] != null) {
      itemVolumes[item.code] = manualItems[item.code];
      itemSources[item.code] = SOURCE.manual;
    } else if (itemsFromDrawing[item.code] != null) {
      itemVolumes[item.code] = itemsFromDrawing[item.code];
      itemSources[item.code] = SOURCE.drawing;
    } else {
      itemSources[item.code] = SOURCE.template;
    }
  }

  const request = {
    template,
    spec_class: rab.specClass || "Menengah",
    volumes,
    item_volumes: itemVolumes,
    material_prices: rab.materialPrices || {},
    labor_rates: rab.laborRates || {},
    parameters: rab.parameters || {},
    stage_progress: rab.stageProgress || {},
    ...(rab.currentWeek ? { current_week: rab.currentWeek } : {}),
  };
  return { template, request, volumeSources, itemSources, drawingVolumes: fromDrawing, drawingItems: itemsFromDrawing };
}
