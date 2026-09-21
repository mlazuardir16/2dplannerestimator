import { create } from "zustand";
import { uidGen } from "../lib/project";
import { currencyForCountry } from "../lib/countries";

const clone = (o) => JSON.parse(JSON.stringify(o));

// Approximate initial camera fit for the project's buildable-space boundary
// (see CanvasWorkspace.jsx's hard space limit) plus a comfortable margin, so
// opening a project doesn't inherit whatever pan/zoom a previous project left
// behind. Refined further by the user's own pan/zoom afterward.
function fitView(building) {
  const boundW = building?.length > 0 ? building.length : 20;
  const boundH = building?.width > 0 ? building.width : 15;
  const margin = 1.5;
  const viewportW = 900;
  const viewportH = 600;
  const scale = Math.max(8, Math.min(400, Math.min(viewportW / (boundW + margin * 2), viewportH / (boundH + margin * 2))));
  return {
    scale,
    panX: (viewportW - boundW * scale) / 2,
    panY: (viewportH - boundH * scale) / 2,
  };
}

export const useProjectStore = create((set, get) => ({
  project: null,
  activeFloor: 0,
  tool: "select", // select | wall | door | window | column | utility | room | pan
  utilityKind: "lamp",
  wallType: "interior",
  selected: null, // { type, id }
  view: { scale: 48, panX: 200, panY: 140 }, // px per meter, pan in px
  grid: { major: 1, minor: 0.1, snap: true, show: true },
  ghost: true,
  dirty: false,
  highlightIds: [], // element ids highlighted from BOQ drill-down
  history: { past: [], future: [] },

  setProject: (project) =>
    set({
      project,
      activeFloor: 0,
      selected: null,
      dirty: false,
      history: { past: [], future: [] },
      view: fitView(project?.building),
    }),

  markSaved: () => set({ dirty: false }),
  setTool: (tool) => set({ tool, selected: tool === "select" ? get().selected : null }),
  setUtilityKind: (utilityKind) => set({ utilityKind, tool: "utility" }),
  setWallType: (wallType) => set({ wallType }),
  setSelected: (selected) => set({ selected }),
  setActiveFloor: (activeFloor) => set({ activeFloor, selected: null }),
  toggleGhost: () => set((s) => ({ ghost: !s.ghost })),
  toggleSnap: () => set((s) => ({ grid: { ...s.grid, snap: !s.grid.snap } })),
  toggleGridShow: () => set((s) => ({ grid: { ...s.grid, show: !s.grid.show } })),
  setView: (view) => set({ view }),
  setHighlight: (ids) => set({ highlightIds: ids || [] }),
  clearHighlight: () => set({ highlightIds: [] }),

  currentFloor: () => {
    const s = get();
    return s.project?.floors?.[s.activeFloor];
  },

  // push current floors snapshot to history before a mutation
  _snapshot: () => {
    const s = get();
    const snap = clone(s.project.floors);
    set({
      history: { past: [...s.history.past, snap].slice(-80), future: [] },
    });
  },

  // apply a mutator(floors) that edits the floors array in place; records history
  commit: (mutator) => {
    const s = get();
    if (!s.project) return;
    s._snapshot();
    const floors = clone(s.project.floors);
    mutator(floors, s.activeFloor);
    set({ project: { ...s.project, floors }, dirty: true });
  },

  // like commit but no history (used during live drags)
  applyRaw: (mutator) => {
    const s = get();
    if (!s.project) return;
    const floors = clone(s.project.floors);
    mutator(floors, s.activeFloor);
    set({ project: { ...s.project, floors }, dirty: true });
  },

  beginHistory: () => get()._snapshot(),

  undo: () => {
    const s = get();
    if (!s.history.past.length) return;
    const past = [...s.history.past];
    const prev = past.pop();
    const future = [clone(s.project.floors), ...s.history.future].slice(0, 80);
    set({
      project: { ...s.project, floors: prev },
      history: { past, future },
      dirty: true,
      selected: null,
    });
  },

  redo: () => {
    const s = get();
    if (!s.history.future.length) return;
    const future = [...s.history.future];
    const next = future.shift();
    const past = [...s.history.past, clone(s.project.floors)].slice(-80);
    set({
      project: { ...s.project, floors: next },
      history: { past, future },
      dirty: true,
      selected: null,
    });
  },

  // ---- Geometry mutations ----
  addWall: (start, end) => {
    const id = uidGen();
    const s = get();
    s.commit((floors, fi) => {
      floors[fi].walls.push({
        id,
        start,
        end,
        thickness: s.wallType === "exterior" ? 0.2 : s.wallType === "fence" ? 0.1 : 0.15,
        height: floors[fi].height || 3.2,
        material: "brick",
        wallType: s.wallType,
      });
    });
    return id;
  },

  updateWallRaw: (id, patch) => {
    get().applyRaw((floors, fi) => {
      const w = floors[fi].walls.find((x) => x.id === id);
      if (w) Object.assign(w, patch);
    });
  },

  updateWall: (id, patch) => {
    get().commit((floors, fi) => {
      const w = floors[fi].walls.find((x) => x.id === id);
      if (w) Object.assign(w, patch);
    });
  },

  deleteWall: (id) => {
    get().commit((floors, fi) => {
      const f = floors[fi];
      f.walls = f.walls.filter((w) => w.id !== id);
      f.doors = f.doors.filter((d) => d.wallId !== id);
      f.windows = f.windows.filter((w) => w.wallId !== id);
    });
    set({ selected: null });
  },

  addDoor: (wallId, t) => {
    const id = uidGen();
    get().commit((floors, fi) => {
      floors[fi].doors.push({ id, wallId, t, width: 0.9, height: 2.1, type: "single", material: "wood" });
    });
    return id;
  },

  addWindow: (wallId, t) => {
    const id = uidGen();
    get().commit((floors, fi) => {
      floors[fi].windows.push({ id, wallId, t, width: 1.2, height: 1.5, sill: 0.9, type: "sliding", material: "aluminum" });
    });
    return id;
  },

  updateOpening: (kind, id, patch) => {
    get().commit((floors, fi) => {
      const arr = kind === "door" ? floors[fi].doors : floors[fi].windows;
      const o = arr.find((x) => x.id === id);
      if (o) Object.assign(o, patch);
    });
  },

  updateOpeningRaw: (kind, id, patch) => {
    get().applyRaw((floors, fi) => {
      const arr = kind === "door" ? floors[fi].doors : floors[fi].windows;
      const o = arr.find((x) => x.id === id);
      if (o) Object.assign(o, patch);
    });
  },

  addColumn: (x, y) => {
    const id = uidGen();
    get().commit((floors, fi) => {
      floors[fi].columns.push({ id, x, y, width: 0.2, depth: 0.2, height: floors[fi].height || 3.2 });
    });
    return id;
  },

  updateColumnRaw: (id, patch) => {
    get().applyRaw((floors, fi) => {
      const c = floors[fi].columns.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
    });
  },

  updateColumn: (id, patch) => {
    get().commit((floors, fi) => {
      const c = floors[fi].columns.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
    });
  },

  addUtility: (kind, x, y) => {
    const id = uidGen();
    get().commit((floors, fi) => {
      floors[fi].utilities.push({ id, kind, x, y });
    });
    return id;
  },

  updateUtilityRaw: (id, patch) => {
    get().applyRaw((floors, fi) => {
      const u = floors[fi].utilities.find((x) => x.id === id);
      if (u) Object.assign(u, patch);
    });
  },

  // ---- Custom items (manual point/line, for anything non-standard) ----
  addCustomPoint: (x, y) => {
    const id = uidGen();
    get().commit((floors, fi) => {
      if (!floors[fi].customItems) floors[fi].customItems = [];
      floors[fi].customItems.push({ id, kind: "point", x, y, name: "Custom Item", unit: "unit", quantity: 1, unitPrice: 0 });
    });
    return id;
  },

  addCustomLine: (start, end) => {
    const id = uidGen();
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    get().commit((floors, fi) => {
      if (!floors[fi].customItems) floors[fi].customItems = [];
      floors[fi].customItems.push({
        id, kind: "line", start, end, name: "Custom Item", unit: "m",
        quantity: Number(length.toFixed(2)), unitPrice: 0,
      });
    });
    return id;
  },

  updateCustomItemRaw: (id, patch) => {
    get().applyRaw((floors, fi) => {
      const it = (floors[fi].customItems || []).find((x) => x.id === id);
      if (it) Object.assign(it, patch);
    });
  },

  updateCustomItem: (id, patch) => {
    get().commit((floors, fi) => {
      const it = (floors[fi].customItems || []).find((x) => x.id === id);
      if (it) Object.assign(it, patch);
    });
  },

  // ---- Stairs (first-class standard item, multi-level projects only) ----
  addStair: (x, y) => {
    const id = uidGen();
    get().commit((floors, fi) => {
      if (!floors[fi].stairs) floors[fi].stairs = [];
      floors[fi].stairs.push({ id, x, y, width: 1, depth: 3, steps: 12 });
    });
    return id;
  },

  updateStairRaw: (id, patch) => {
    get().applyRaw((floors, fi) => {
      const st = (floors[fi].stairs || []).find((x) => x.id === id);
      if (st) Object.assign(st, patch);
    });
  },

  updateStair: (id, patch) => {
    get().commit((floors, fi) => {
      const st = (floors[fi].stairs || []).find((x) => x.id === id);
      if (st) Object.assign(st, patch);
    });
  },

  // ---- Railings (first-class standard item, chained like walls) ----
  addRailing: (start, end) => {
    const id = uidGen();
    get().commit((floors, fi) => {
      if (!floors[fi].railings) floors[fi].railings = [];
      floors[fi].railings.push({ id, start, end, height: 0.9 });
    });
    return id;
  },

  updateRailingRaw: (id, patch) => {
    get().applyRaw((floors, fi) => {
      const rl = (floors[fi].railings || []).find((x) => x.id === id);
      if (rl) Object.assign(rl, patch);
    });
  },

  updateRailing: (id, patch) => {
    get().commit((floors, fi) => {
      const rl = (floors[fi].railings || []).find((x) => x.id === id);
      if (rl) Object.assign(rl, patch);
    });
  },

  deleteElement: (type, id) => {
    get().commit((floors, fi) => {
      const f = floors[fi];
      if (type === "wall") {
        f.walls = f.walls.filter((w) => w.id !== id);
        f.doors = f.doors.filter((d) => d.wallId !== id);
        f.windows = f.windows.filter((w) => w.wallId !== id);
      } else if (type === "door") f.doors = f.doors.filter((d) => d.id !== id);
      else if (type === "window") f.windows = f.windows.filter((w) => w.id !== id);
      else if (type === "column") f.columns = f.columns.filter((c) => c.id !== id);
      else if (type === "utility") f.utilities = f.utilities.filter((u) => u.id !== id);
      else if (type === "customPoint" || type === "customLine") f.customItems = (f.customItems || []).filter((x) => x.id !== id);
      else if (type === "stair") f.stairs = (f.stairs || []).filter((x) => x.id !== id);
      else if (type === "railing") f.railings = (f.railings || []).filter((x) => x.id !== id);
    });
    set({ selected: null });
  },

  setRoomName: (key, name, ceilingHeight) => {
    get().commit((floors, fi) => {
      if (!floors[fi].roomNames) floors[fi].roomNames = {};
      floors[fi].roomNames[key] = {
        name,
        ceilingHeight: ceilingHeight ?? floors[fi].roomNames[key]?.ceilingHeight ?? floors[fi].height,
      };
    });
  },

  // project-level (no floor history) updates
  patchProject: (patch) => set((s) => ({ project: { ...s.project, ...patch }, dirty: true })),

  // Currency always follows country (no manual currency conversion exists
  // yet — see lib/project.js for why they must stay in sync). Existing
  // material selections are cleared on country change: they're specific
  // products priced in the old country's currency/market and don't carry
  // over to a different one.
  setCountry: (country) =>
    set((s) => ({
      project: { ...s.project, country, currency: currencyForCountry(country), materialSelections: {} },
      dirty: true,
    })),

  selectMaterial: (category, material) =>
    set((s) => ({
      project: {
        ...s.project,
        materialSelections: { ...s.project.materialSelections, [category]: material },
      },
      dirty: true,
    })),

  clearMaterialSelection: (category) =>
    set((s) => {
      const materialSelections = { ...s.project.materialSelections };
      delete materialSelections[category];
      return { project: { ...s.project, materialSelections }, dirty: true };
    }),

  setRoofConfig: (patch) =>
    set((s) => ({ project: { ...s.project, roof: { ...s.project.roof, ...patch } }, dirty: true })),

  setStructuralSystem: (structuralSystem) =>
    set((s) => ({ project: { ...s.project, structuralSystem }, dirty: true })),

  setWasteFactor: (category, value) =>
    set((s) => {
      const sel = s.project.materialSelections?.[category];
      if (!sel) return {};
      return {
        project: {
          ...s.project,
          materialSelections: {
            ...s.project.materialSelections,
            [category]: { ...sel, wasteFactorOverride: Number(value) },
          },
        },
        dirty: true,
      };
    }),

  addFloor: () =>
    set((s) => {
      const level = s.project.floors.length;
      const floors = [
        ...s.project.floors,
        {
          id: uidGen(),
          level,
          name: `Floor ${level + 1}`,
          height: 3.2,
          walls: [],
          doors: [],
          windows: [],
          columns: [],
          utilities: [],
          customItems: [],
          stairs: [],
          railings: [],
          roomNames: {},
        },
      ];
      return { project: { ...s.project, floors, floorCount: floors.length }, activeFloor: floors.length - 1, dirty: true };
    }),

  duplicateFloor: () =>
    set((s) => {
      const src = clone(s.project.floors[s.activeFloor]);
      src.id = uidGen();
      src.level = s.project.floors.length;
      src.name = `Floor ${src.level + 1}`;
      // Regenerate every element id so the duplicated floor doesn't collide
      // with the source floor, remapping wall-id references on doors/windows
      // too (previously only wall ids were regenerated, silently orphaning
      // every door/window on the duplicated floor since they kept pointing
      // at wall ids that no longer existed there).
      const wallIdMap = new Map();
      src.walls = src.walls.map((w) => {
        const newId = uidGen();
        wallIdMap.set(w.id, newId);
        return { ...w, id: newId };
      });
      src.doors = (src.doors || []).map((d) => ({ ...d, id: uidGen(), wallId: wallIdMap.get(d.wallId) || d.wallId }));
      src.windows = (src.windows || []).map((w) => ({ ...w, id: uidGen(), wallId: wallIdMap.get(w.wallId) || w.wallId }));
      src.columns = (src.columns || []).map((c) => ({ ...c, id: uidGen() }));
      src.utilities = (src.utilities || []).map((u) => ({ ...u, id: uidGen() }));
      src.customItems = (src.customItems || []).map((it) => ({ ...it, id: uidGen() }));
      src.stairs = (src.stairs || []).map((st) => ({ ...st, id: uidGen() }));
      src.railings = (src.railings || []).map((rl) => ({ ...rl, id: uidGen() }));
      const floors = [...s.project.floors, src];
      return { project: { ...s.project, floors, floorCount: floors.length }, activeFloor: floors.length - 1, dirty: true };
    }),

  updateFloorMeta: (idx, patch) =>
    set((s) => {
      const floors = s.project.floors.map((f, i) => (i === idx ? { ...f, ...patch } : f));
      return { project: { ...s.project, floors }, dirty: true };
    }),
}));
