import { create } from "zustand";
import { uidGen } from "../lib/project";

const clone = (o) => JSON.parse(JSON.stringify(o));

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
  highlightIds: [], // element ids highlighted from RAB drill-down
  history: { past: [], future: [] },

  setProject: (project) =>
    set({
      project,
      activeFloor: 0,
      selected: null,
      dirty: false,
      history: { past: [], future: [] },
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
  updateResource: (id, price) =>
    set((s) => ({
      project: {
        ...s.project,
        resourcesDb: s.project.resourcesDb.map((r) => (r.id === id ? { ...r, price: Number(price) || 0 } : r)),
      },
      dirty: true,
    })),
  updateItemField: (id, field, value) =>
    set((s) => ({
      project: {
        ...s.project,
        itemsDb: s.project.itemsDb.map((it) => (it.id === id ? { ...it, [field]: value } : it)),
      },
      dirty: true,
    })),
  updateItemResourceCoef: (itemId, ref, coef) =>
    set((s) => ({
      project: {
        ...s.project,
        itemsDb: s.project.itemsDb.map((it) =>
          it.id === itemId
            ? { ...it, resources: it.resources.map((r) => (r.ref === ref ? { ...r, coef: Number(coef) || 0 } : r)) }
            : it
        ),
      },
      dirty: true,
    })),

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
      // regenerate element ids so they don't collide
      src.walls = src.walls.map((w) => ({ ...w, id: uidGen() }));
      const floors = [...s.project.floors, src];
      return { project: { ...s.project, floors, floorCount: floors.length }, activeFloor: floors.length - 1, dirty: true };
    }),

  updateFloorMeta: (idx, patch) =>
    set((s) => {
      const floors = s.project.floors.map((f, i) => (i === idx ? { ...f, ...patch } : f));
      return { project: { ...s.project, floors }, dirty: true };
    }),
}));
