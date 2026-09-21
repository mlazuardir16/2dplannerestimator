import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { useProjectStore } from "@/store/useProjectStore";
import {
  detectRooms,
  pointToSegment,
  dist,
  polygonCentroid,
  roomKey,
} from "@/lib/geometry";
import { UTILITY_KINDS } from "@/lib/constructionItems";

const WALL_COLORS = {
  exterior: "#1E293B",
  interior: "#475569",
  fence: "#92400E",
};

// Tools that draw a two-click line. `chain` keeps re-arming the preview after
// each commit (like walls); non-chaining tools commit one segment, select it,
// and revert to "select" so the user goes straight to pricing it.
const LINE_TOOLS = {
  customLine: { chain: false, revertToSelect: true, color: "#78716C" },
  railing: { chain: true, revertToSelect: false, color: "#0F766E" },
};

function utilColor(kind) {
  const k = UTILITY_KINDS.find((u) => u.id === kind);
  if (!k) return "#64748B";
  if (k.category === "electrical") return "#EA580C";
  if (k.category === "plumbing") return "#0284C7";
  return "#6366F1";
}

export default function CanvasWorkspace() {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const [preview, setPreview] = useState(null); // wall drawing preview {start, end}
  const [linePreview, setLinePreview] = useState(null); // customLine/railing preview {start, end}
  const [size, setSize] = useState({ w: 1000, h: 700 });
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  const project = useProjectStore((s) => s.project);
  const activeFloor = useProjectStore((s) => s.activeFloor);
  const tool = useProjectStore((s) => s.tool);
  const utilityKind = useProjectStore((s) => s.utilityKind);
  const grid = useProjectStore((s) => s.grid);
  const view = useProjectStore((s) => s.view);
  const ghost = useProjectStore((s) => s.ghost);
  const selected = useProjectStore((s) => s.selected);
  const highlightIds = useProjectStore((s) => s.highlightIds);

  const setView = useProjectStore((s) => s.setView);
  const setSelected = useProjectStore((s) => s.setSelected);
  const setTool = useProjectStore((s) => s.setTool);
  const addWall = useProjectStore((s) => s.addWall);
  const addDoor = useProjectStore((s) => s.addDoor);
  const addWindow = useProjectStore((s) => s.addWindow);
  const addColumn = useProjectStore((s) => s.addColumn);
  const addUtility = useProjectStore((s) => s.addUtility);
  const addCustomPoint = useProjectStore((s) => s.addCustomPoint);
  const addCustomLine = useProjectStore((s) => s.addCustomLine);
  const addStair = useProjectStore((s) => s.addStair);
  const addRailing = useProjectStore((s) => s.addRailing);
  const updateWallRaw = useProjectStore((s) => s.updateWallRaw);
  const updateColumnRaw = useProjectStore((s) => s.updateColumnRaw);
  const updateUtilityRaw = useProjectStore((s) => s.updateUtilityRaw);
  const updateOpeningRaw = useProjectStore((s) => s.updateOpeningRaw);
  const updateCustomItemRaw = useProjectStore((s) => s.updateCustomItemRaw);
  const updateStairRaw = useProjectStore((s) => s.updateStairRaw);
  const updateRailingRaw = useProjectStore((s) => s.updateRailingRaw);
  const beginHistory = useProjectStore((s) => s.beginHistory);
  const deleteElement = useProjectStore((s) => s.deleteElement);

  const floor = project?.floors?.[activeFloor];
  const walls = floor?.walls || [];
  const highlightSet = useMemo(() => new Set(highlightIds), [highlightIds]);

  const rooms = useMemo(() => detectRooms(walls), [walls]);

  // Hard editable-space limit: the project's configured building footprint.
  // Falls back to a generous default for blank projects that never set one.
  const boundW = project?.building?.length > 0 ? project.building.length : 20;
  const boundH = project?.building?.width > 0 ? project.building.width : 15;

  // resize observer
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const toWorld = useCallback(
    (clientX, clientY) => {
      const rect = svgRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - view.panX) / view.scale,
        y: (clientY - rect.top - view.panY) / view.scale,
      };
    },
    [view]
  );

  const clampToBounds = useCallback(
    (p) => ({ x: Math.min(Math.max(p.x, 0), boundW), y: Math.min(Math.max(p.y, 0), boundH) }),
    [boundW, boundH]
  );

  const snap = useCallback(
    (p) => {
      let result = p;
      if (grid.snap) {
        // vertex magnet first
        const thr = 0.25;
        let best = null;
        for (const w of walls) {
          for (const v of [w.start, w.end]) {
            const d = dist(p, v);
            if (d < thr && (!best || d < best.d)) best = { d, v };
          }
        }
        if (best) result = { x: best.v.x, y: best.v.y };
        else {
          const step = grid.minor;
          result = { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
        }
      }
      // Hard space limit applies regardless of snap-to-grid being on/off.
      return clampToBounds(result);
    },
    [grid, walls, clampToBounds]
  );

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      const rect = svgRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = (mx - view.panX) / view.scale;
      const worldY = (my - view.panY) / view.scale;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const scale = Math.max(8, Math.min(400, view.scale * factor));
      setView({
        scale,
        panX: mx - worldX * scale,
        panY: my - worldY * scale,
      });
    },
    [view, setView]
  );

  const startPan = (e) => {
    panRef.current = { sx: e.clientX, sy: e.clientY, panX: view.panX, panY: view.panY };
  };

  const onSvgPointerDown = (e) => {
    if (e.button === 1 || tool === "pan" || (e.button === 0 && e.spaceKey)) {
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    const world = snap(toWorld(e.clientX, e.clientY));

    if (tool === "wall") {
      if (!preview) {
        setPreview({ start: world, end: world });
      } else {
        if (dist(preview.start, world) > 0.05) {
          addWall(preview.start, world);
          setPreview({ start: world, end: world }); // chain
        }
      }
      return;
    }
    if (tool === "column") {
      const id = addColumn(world.x, world.y);
      setSelected({ type: "column", id });
      return;
    }
    if (tool === "utility") {
      const id = addUtility(utilityKind, world.x, world.y);
      setSelected({ type: "utility", id });
      return;
    }
    if (tool === "customPoint") {
      const id = addCustomPoint(world.x, world.y);
      setSelected({ type: "customPoint", id });
      return;
    }
    if (tool === "stair") {
      const id = addStair(world.x, world.y);
      setSelected({ type: "stair", id });
      return;
    }
    if (LINE_TOOLS[tool]) {
      const cfg = LINE_TOOLS[tool];
      if (!linePreview) {
        setLinePreview({ start: world, end: world });
      } else if (dist(linePreview.start, world) > 0.05) {
        const id = tool === "customLine" ? addCustomLine(linePreview.start, world) : addRailing(linePreview.start, world);
        setSelected({ type: tool, id });
        if (cfg.chain) {
          setLinePreview({ start: world, end: world });
        } else {
          setLinePreview(null);
          if (cfg.revertToSelect) setTool("select");
        }
      }
      return;
    }
    // select tool on empty area -> deselect
    setSelected(null);
  };

  const onSvgPointerMove = (e) => {
    if (panRef.current) {
      const p = panRef.current;
      setView({ scale: view.scale, panX: p.panX + (e.clientX - p.sx), panY: p.panY + (e.clientY - p.sy) });
      return;
    }
    const world = toWorld(e.clientX, e.clientY);
    setCursor(world);

    if (tool === "wall" && preview) {
      setPreview((pv) => ({ start: pv.start, end: snap(world) }));
      return;
    }
    if (LINE_TOOLS[tool] && linePreview) {
      setLinePreview((pv) => ({ start: pv.start, end: snap(world) }));
      return;
    }

    const d = dragRef.current;
    if (!d) return;
    const w = snap(world);
    if (d.mode === "wall-move") {
      const dx = w.x - d.startWorld.x;
      const dy = w.y - d.startWorld.y;
      updateWallRaw(d.id, {
        start: { x: d.orig.start.x + dx, y: d.orig.start.y + dy },
        end: { x: d.orig.end.x + dx, y: d.orig.end.y + dy },
      });
    } else if (d.mode === "wall-start") {
      updateWallRaw(d.id, { start: { x: w.x, y: w.y } });
    } else if (d.mode === "wall-end") {
      updateWallRaw(d.id, { end: { x: w.x, y: w.y } });
    } else if (d.mode === "column") {
      updateColumnRaw(d.id, { x: w.x, y: w.y });
    } else if (d.mode === "utility") {
      updateUtilityRaw(d.id, { x: w.x, y: w.y });
    } else if (d.mode === "customPoint") {
      updateCustomItemRaw(d.id, { x: w.x, y: w.y });
    } else if (d.mode === "stair") {
      updateStairRaw(d.id, { x: w.x, y: w.y });
    } else if (d.mode === "opening") {
      // move opening along its wall
      const wall = walls.find((x) => x.id === d.wallId);
      if (wall) {
        const r = pointToSegment(world, wall.start, wall.end);
        updateOpeningRaw(d.kind, d.id, { t: r.t });
      }
    } else if (d.itemType === "customLine" || d.itemType === "railing") {
      const updateRaw = d.itemType === "customLine" ? updateCustomItemRaw : updateRailingRaw;
      if (d.mode === "line-move") {
        const dx = w.x - d.startWorld.x;
        const dy = w.y - d.startWorld.y;
        updateRaw(d.id, {
          start: { x: d.orig.start.x + dx, y: d.orig.start.y + dy },
          end: { x: d.orig.end.x + dx, y: d.orig.end.y + dy },
        });
      } else if (d.mode === "line-start") {
        updateRaw(d.id, { start: { x: w.x, y: w.y } });
      } else if (d.mode === "line-end") {
        updateRaw(d.id, { end: { x: w.x, y: w.y } });
      }
    }
  };

  const endInteraction = () => {
    panRef.current = null;
    dragRef.current = null;
  };

  // element handlers
  const beginWallDrag = (e, wall, mode) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelected({ type: "wall", id: wall.id });
    beginHistory();
    dragRef.current = {
      mode,
      id: wall.id,
      startWorld: snap(toWorld(e.clientX, e.clientY)),
      orig: { start: { ...wall.start }, end: { ...wall.end } },
    };
  };

  const beginLineDrag = (e, itemType, item, mode) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelected({ type: itemType, id: item.id });
    beginHistory();
    dragRef.current = {
      itemType,
      mode,
      id: item.id,
      startWorld: snap(toWorld(e.clientX, e.clientY)),
      orig: { start: { ...item.start }, end: { ...item.end } },
    };
  };

  const onWallBody = (e, wall) => {
    e.stopPropagation();
    const world = toWorld(e.clientX, e.clientY);
    if (tool === "door") {
      const r = pointToSegment(world, wall.start, wall.end);
      const id = addDoor(wall.id, r.t);
      setSelected({ type: "door", id });
      return;
    }
    if (tool === "window") {
      const r = pointToSegment(world, wall.start, wall.end);
      const id = addWindow(wall.id, r.t);
      setSelected({ type: "window", id });
      return;
    }
    beginWallDrag(e, wall, "wall-move");
  };

  const onColumnDown = (e, c) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelected({ type: "column", id: c.id });
    beginHistory();
    dragRef.current = { mode: "column", id: c.id };
  };
  const onUtilDown = (e, u) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelected({ type: "utility", id: u.id });
    beginHistory();
    dragRef.current = { mode: "utility", id: u.id };
  };
  const onCustomPointDown = (e, item) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelected({ type: "customPoint", id: item.id });
    beginHistory();
    dragRef.current = { mode: "customPoint", id: item.id };
  };
  const onStairDown = (e, item) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelected({ type: "stair", id: item.id });
    beginHistory();
    dragRef.current = { mode: "stair", id: item.id };
  };
  const onOpeningDown = (e, kind, o, wall) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelected({ type: kind, id: o.id });
    beginHistory();
    dragRef.current = { mode: "opening", kind, id: o.id, wallId: wall.id };
  };

  // keyboard delete + escape
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected && !isTyping()) {
        e.preventDefault();
        deleteElement(selected.type, selected.id);
      }
      if (e.key === "Escape") {
        setPreview(null);
        setLinePreview(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, deleteElement]);

  if (!floor) return null;

  const s = view.scale;
  const hr = 6 / s; // handle radius world
  const fontS = 12 / s;
  const smallFont = 10 / s;

  const ghostFloor = ghost && activeFloor > 0 ? project.floors[activeFloor - 1] : null;
  const activeLineCfg = LINE_TOOLS[tool];

  return (
    <div className={`relative h-full w-full canvas-area tool-${tool}`}>
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        className="block h-full w-full bg-slate-100"
        onWheel={handleWheel}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={endInteraction}
        onPointerLeave={endInteraction}
        data-testid="planner-canvas-svg"
      >
        <defs>
          <pattern id="minorGrid" width={grid.minor * s} height={grid.minor * s} patternUnits="userSpaceOnUse" patternTransform={`translate(${view.panX} ${view.panY})`}>
            <path d={`M ${grid.minor * s} 0 L 0 0 0 ${grid.minor * s}`} fill="none" stroke="#E9EEF5" strokeWidth="1" />
          </pattern>
          <pattern id="majorGrid" width={grid.major * s} height={grid.major * s} patternUnits="userSpaceOnUse" patternTransform={`translate(${view.panX} ${view.panY})`}>
            <rect width={grid.major * s} height={grid.major * s} fill="url(#minorGrid)" />
            <path d={`M ${grid.major * s} 0 L 0 0 0 ${grid.major * s}`} fill="none" stroke="#CBD5E1" strokeWidth="1.2" />
          </pattern>
        </defs>

        {grid.show && <rect x="0" y="0" width={size.w} height={size.h} fill="url(#majorGrid)" />}

        <g transform={`translate(${view.panX} ${view.panY}) scale(${s})`}>
          {/* buildable-space boundary (hard limit) */}
          <rect
            x={0}
            y={0}
            width={boundW}
            height={boundH}
            fill="none"
            stroke="#94A3B8"
            strokeWidth={2 / s}
            strokeDasharray={`${0.22} ${0.16}`}
            style={{ pointerEvents: "none" }}
          />

          {/* origin marker */}
          <circle cx={0} cy={0} r={3 / s} fill="#1E56A0" opacity="0.6" />

          {/* ghost reference layer */}
          {ghostFloor &&
            ghostFloor.walls.map((w) => (
              <line
                key={"ghost" + w.id}
                x1={w.start.x}
                y1={w.start.y}
                x2={w.end.x}
                y2={w.end.y}
                stroke="#94A3B8"
                strokeWidth={w.thickness}
                strokeLinecap="round"
                opacity="0.35"
              />
            ))}

          {/* rooms */}
          {rooms.map((r) => {
            const key = roomKey(r.centroid);
            const meta = floor.roomNames?.[key];
            return (
              <g key={r.id} style={{ pointerEvents: tool === "select" ? "auto" : "none" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelected({ type: "room", id: key, area: r.area, perimeter: r.perimeter, centroid: r.centroid });
                }}
              >
                <polygon
                  points={r.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill={selected?.type === "room" && selected.id === key ? "rgba(30,86,160,0.14)" : "rgba(224,231,255,0.35)"}
                  stroke="none"
                />
                <text x={r.centroid.x} y={r.centroid.y - fontS * 0.2} textAnchor="middle" fontSize={fontS} fontWeight="600" fill="#334155">
                  {meta?.name || "Room"}
                </text>
                <text x={r.centroid.x} y={r.centroid.y + fontS} textAnchor="middle" fontSize={smallFont} fill="#64748B" className="font-mono">
                  {r.area.toFixed(1)} m²
                </text>
              </g>
            );
          })}

          {/* walls */}
          {walls.map((w) => {
            const isSel = selected?.type === "wall" && selected.id === w.id;
            const isHi = highlightSet.has(w.id);
            const color = isSel ? "#2563EB" : isHi ? "#D97706" : WALL_COLORS[w.wallType] || "#1E293B";
            const interactive = tool === "select" || tool === "door" || tool === "window";
            return (
              <g key={w.id}>
                <line x1={w.start.x} y1={w.start.y} x2={w.end.x} y2={w.end.y} stroke={color} strokeWidth={w.thickness} strokeLinecap="square" />
                {/* invisible hit line */}
                <line
                  x1={w.start.x}
                  y1={w.start.y}
                  x2={w.end.x}
                  y2={w.end.y}
                  stroke="transparent"
                  strokeWidth={Math.max(w.thickness, 0.35)}
                  strokeLinecap="round"
                  style={{ pointerEvents: interactive ? "stroke" : "none", cursor: tool === "select" ? "move" : "copy" }}
                  onPointerDown={(e) => onWallBody(e, w)}
                />
                {/* dimension label */}
                <WallDimension wall={w} fontS={smallFont} />
                {/* endpoint handles */}
                {isSel && tool === "select" && (
                  <>
                    <circle cx={w.start.x} cy={w.start.y} r={hr} fill="#fff" stroke="#2563EB" strokeWidth={1.5 / s} style={{ cursor: "pointer" }} onPointerDown={(e) => beginWallDrag(e, w, "wall-start")} />
                    <circle cx={w.end.x} cy={w.end.y} r={hr} fill="#fff" stroke="#2563EB" strokeWidth={1.5 / s} style={{ cursor: "pointer" }} onPointerDown={(e) => beginWallDrag(e, w, "wall-end")} />
                  </>
                )}
              </g>
            );
          })}

          {/* openings */}
          {floor.doors.map((d) => {
            const wall = walls.find((x) => x.id === d.wallId);
            if (!wall) return null;
            return <Opening key={d.id} kind="door" o={d} wall={wall} selected={selected} onDown={(e) => onOpeningDown(e, "door", d, wall)} scale={s} tool={tool} />;
          })}
          {floor.windows.map((wn) => {
            const wall = walls.find((x) => x.id === wn.wallId);
            if (!wall) return null;
            return <Opening key={wn.id} kind="window" o={wn} wall={wall} selected={selected} onDown={(e) => onOpeningDown(e, "window", wn, wall)} scale={s} tool={tool} />;
          })}

          {/* columns */}
          {floor.columns.map((c) => {
            const isSel = selected?.type === "column" && selected.id === c.id;
            return (
              <rect
                key={c.id}
                x={c.x - c.width / 2}
                y={c.y - c.depth / 2}
                width={c.width}
                height={c.depth}
                fill={isSel ? "#2563EB" : "#334155"}
                stroke="#0f172a"
                strokeWidth={1 / s}
                style={{ pointerEvents: tool === "select" ? "auto" : "none", cursor: "move" }}
                onPointerDown={(e) => onColumnDown(e, c)}
              />
            );
          })}

          {/* stairs */}
          {(floor.stairs || []).map((st) => {
            const isSel = selected?.type === "stair" && selected.id === st.id;
            const color = isSel ? "#2563EB" : "#334155";
            const w2 = st.width || 1;
            const d2 = st.depth || 3;
            const steps = st.steps || 12;
            const x0 = st.x - w2 / 2;
            const y0 = st.y - d2 / 2;
            return (
              <g key={st.id} style={{ pointerEvents: tool === "select" ? "auto" : "none", cursor: "move" }} onPointerDown={(e) => onStairDown(e, st)}>
                <rect x={x0} y={y0} width={w2} height={d2} fill="#fff" stroke={color} strokeWidth={1.5 / s} />
                {Array.from({ length: steps - 1 }).map((_, i) => {
                  const yy = y0 + (d2 / steps) * (i + 1);
                  return <line key={i} x1={x0} y1={yy} x2={x0 + w2} y2={yy} stroke={color} strokeWidth={0.7 / s} />;
                })}
                <polygon points={`${st.x - w2 * 0.18},${y0 + d2 * 0.32} ${st.x + w2 * 0.18},${y0 + d2 * 0.32} ${st.x},${y0 + d2 * 0.08}`} fill={color} />
                <text x={st.x} y={y0 + d2 * 0.55} textAnchor="middle" fontSize={smallFont} fontWeight="700" fill={color}>UP</text>
              </g>
            );
          })}

          {/* railings */}
          {(floor.railings || []).map((rl) => {
            const isSel = selected?.type === "railing" && selected.id === rl.id;
            const color = isSel ? "#2563EB" : "#0F766E";
            const len = dist(rl.start, rl.end);
            const ang = Math.atan2(rl.end.y - rl.start.y, rl.end.x - rl.start.x);
            const nx = -Math.sin(ang);
            const ny = Math.cos(ang);
            const tickCount = Math.max(1, Math.round(len / 0.5));
            return (
              <g key={rl.id}>
                <line
                  x1={rl.start.x} y1={rl.start.y} x2={rl.end.x} y2={rl.end.y}
                  stroke={color} strokeWidth={0.04}
                  style={{ pointerEvents: tool === "select" ? "stroke" : "none", cursor: "move" }}
                  onPointerDown={(e) => beginLineDrag(e, "railing", rl, "line-move")}
                />
                {Array.from({ length: tickCount + 1 }).map((_, i) => {
                  const t = i / tickCount;
                  const px = rl.start.x + (rl.end.x - rl.start.x) * t;
                  const py = rl.start.y + (rl.end.y - rl.start.y) * t;
                  return <line key={i} x1={px} y1={py} x2={px + nx * 0.14} y2={py + ny * 0.14} stroke={color} strokeWidth={0.03} style={{ pointerEvents: "none" }} />;
                })}
                {isSel && tool === "select" && (
                  <>
                    <circle cx={rl.start.x} cy={rl.start.y} r={hr} fill="#fff" stroke="#2563EB" strokeWidth={1.5 / s} onPointerDown={(e) => beginLineDrag(e, "railing", rl, "line-start")} />
                    <circle cx={rl.end.x} cy={rl.end.y} r={hr} fill="#fff" stroke="#2563EB" strokeWidth={1.5 / s} onPointerDown={(e) => beginLineDrag(e, "railing", rl, "line-end")} />
                  </>
                )}
              </g>
            );
          })}

          {/* custom items */}
          {(floor.customItems || []).map((item) => {
            const isSel = selected?.id === item.id && (selected?.type === "customPoint" || selected?.type === "customLine");
            const color = isSel ? "#2563EB" : "#78716C";
            if (item.kind === "point") {
              return (
                <g key={item.id} style={{ pointerEvents: tool === "select" ? "auto" : "none", cursor: "move" }} onPointerDown={(e) => onCustomPointDown(e, item)}>
                  <circle cx={item.x} cy={item.y - 0.06} r={0.12} fill={color} stroke="#fff" strokeWidth={1 / s} />
                  <polygon points={`${item.x - 0.06},${item.y - 0.02} ${item.x + 0.06},${item.y - 0.02} ${item.x},${item.y + 0.14}`} fill={color} />
                  <text x={item.x} y={item.y - 0.24} textAnchor="middle" fontSize={smallFont} fill={color} className="font-mono">{item.name}</text>
                </g>
              );
            }
            return (
              <g key={item.id}>
                <line
                  x1={item.start.x} y1={item.start.y} x2={item.end.x} y2={item.end.y}
                  stroke={color} strokeWidth={0.05} strokeDasharray={`${0.12} ${0.08}`}
                  style={{ pointerEvents: tool === "select" ? "stroke" : "none", cursor: "move" }}
                  onPointerDown={(e) => beginLineDrag(e, "customLine", item, "line-move")}
                />
                {isSel && tool === "select" && (
                  <>
                    <circle cx={item.start.x} cy={item.start.y} r={hr} fill="#fff" stroke="#2563EB" strokeWidth={1.5 / s} onPointerDown={(e) => beginLineDrag(e, "customLine", item, "line-start")} />
                    <circle cx={item.end.x} cy={item.end.y} r={hr} fill="#fff" stroke="#2563EB" strokeWidth={1.5 / s} onPointerDown={(e) => beginLineDrag(e, "customLine", item, "line-end")} />
                  </>
                )}
                <text x={(item.start.x + item.end.x) / 2} y={(item.start.y + item.end.y) / 2 - 0.15} textAnchor="middle" fontSize={smallFont} fill={color} className="font-mono">{item.name}</text>
              </g>
            );
          })}

          {/* utilities */}
          {floor.utilities.map((u) => {
            const isSel = selected?.type === "utility" && selected.id === u.id;
            const r = 0.16;
            return (
              <g key={u.id} style={{ pointerEvents: tool === "select" ? "auto" : "none", cursor: "move" }} onPointerDown={(e) => onUtilDown(e, u)}>
                <circle cx={u.x} cy={u.y} r={r} fill="transparent" />
                <UtilityGlyph kind={u.kind} x={u.x} y={u.y} r={r} color={isSel ? "#2563EB" : utilColor(u.kind)} scale={s} />
              </g>
            );
          })}

          {/* preview wall */}
          {preview && (
            <g>
              <line x1={preview.start.x} y1={preview.start.y} x2={preview.end.x} y2={preview.end.y} stroke="#2563EB" strokeWidth={0.15} strokeLinecap="round" opacity="0.6" strokeDasharray={`${0.15} ${0.1}`} />
              <text x={(preview.start.x + preview.end.x) / 2} y={(preview.start.y + preview.end.y) / 2 - 0.2} textAnchor="middle" fontSize={fontS} fill="#2563EB" fontWeight="700" className="font-mono">
                {dist(preview.start, preview.end).toFixed(2)} m
              </text>
              <circle cx={preview.start.x} cy={preview.start.y} r={hr} fill="#2563EB" />
            </g>
          )}

          {/* preview custom-line / railing */}
          {linePreview && activeLineCfg && (
            <g>
              <line x1={linePreview.start.x} y1={linePreview.start.y} x2={linePreview.end.x} y2={linePreview.end.y} stroke={activeLineCfg.color} strokeWidth={0.08} strokeLinecap="round" opacity="0.7" strokeDasharray={`${0.15} ${0.1}`} />
              <text x={(linePreview.start.x + linePreview.end.x) / 2} y={(linePreview.start.y + linePreview.end.y) / 2 - 0.2} textAnchor="middle" fontSize={fontS} fill={activeLineCfg.color} fontWeight="700" className="font-mono">
                {dist(linePreview.start, linePreview.end).toFixed(2)} m
              </text>
              <circle cx={linePreview.start.x} cy={linePreview.start.y} r={hr} fill={activeLineCfg.color} />
            </g>
          )}
        </g>
      </svg>

      {/* cursor coordinate readout */}
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-1 font-mono text-[11px] text-slate-500 shadow-sm">
        x {cursor.x.toFixed(2)}m · y {cursor.y.toFixed(2)}m
      </div>
      {tool === "wall" && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-1.5 text-xs font-medium text-white shadow">
          Click to place points · Esc to finish
        </div>
      )}
      {tool === "railing" && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-1.5 text-xs font-medium text-white shadow">
          Click to place points · Esc to finish
        </div>
      )}
      {tool === "customLine" && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-1.5 text-xs font-medium text-white shadow">
          Click a start and end point
        </div>
      )}
    </div>
  );
}

function isTyping() {
  const el = document.activeElement;
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

function WallDimension({ wall, fontS }) {
  const mx = (wall.start.x + wall.end.x) / 2;
  const my = (wall.start.y + wall.end.y) / 2;
  const len = dist(wall.start, wall.end);
  const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
  const nx = Math.sin(angle);
  const ny = -Math.cos(angle);
  const off = 0.28;
  return (
    <text
      x={mx + nx * off}
      y={my + ny * off}
      textAnchor="middle"
      fontSize={fontS}
      fill="#64748B"
      className="font-mono"
      style={{ pointerEvents: "none" }}
    >
      {len.toFixed(2)}
    </text>
  );
}

function Opening({ kind, o, wall, selected, onDown, scale, tool }) {
  const len = dist(wall.start, wall.end);
  if (len < 0.01) return null;
  const ang = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const nx = -dy;
  const ny = dx;
  const halfW = (o.width || 0.9) / 2;
  const cx = wall.start.x + dx * (o.t * len);
  const cy = wall.start.y + dy * (o.t * len);
  const x1 = cx - dx * halfW;
  const y1 = cy - dy * halfW;
  const x2 = cx + dx * halfW;
  const y2 = cy + dy * halfW;
  const isSel = selected?.type === kind && selected.id === o.id;
  const th = wall.thickness + 0.02;

  return (
    <g style={{ pointerEvents: tool === "select" ? "auto" : "none", cursor: "move" }} onPointerDown={onDown}>
      {/* clear the wall */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F1F5F9" strokeWidth={th} strokeLinecap="butt" />
      {kind === "door" ? (
        <>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isSel ? "#2563EB" : "#0284C7"} strokeWidth={2 / scale} />
          <path
            d={`M ${x1} ${y1} A ${o.width} ${o.width} 0 0 1 ${x1 + nx * o.width} ${y1 + ny * o.width}`}
            fill="none"
            stroke={isSel ? "#2563EB" : "#0284C7"}
            strokeWidth={1.2 / scale}
            opacity="0.7"
          />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isSel ? "#2563EB" : "#38BDF8"} strokeWidth={th} strokeLinecap="butt" opacity="0.5" />
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isSel ? "#2563EB" : "#0EA5E9"} strokeWidth={2 / scale} />
        </>
      )}
    </g>
  );
}

// Simplified international MEP/plan symbols, replacing the old single-letter
// markers (which collided: lamp/shower/sink/switch could all read as "S").
function UtilityGlyph({ kind, x, y, r, color, scale }) {
  const sw = 1.4 / scale;
  switch (kind) {
    case "lamp":
      return (
        <>
          <circle cx={x} cy={y} r={r} fill="#fff" stroke={color} strokeWidth={sw} />
          <line x1={x - r * 0.6} y1={y - r * 0.6} x2={x + r * 0.6} y2={y + r * 0.6} stroke={color} strokeWidth={sw} />
          <line x1={x - r * 0.6} y1={y + r * 0.6} x2={x + r * 0.6} y2={y - r * 0.6} stroke={color} strokeWidth={sw} />
        </>
      );
    case "switch":
      return (
        <>
          <circle cx={x} cy={y} r={r * 0.5} fill={color} />
          <line x1={x + r * 0.35} y1={y - r * 0.35} x2={x + r * 1.1} y2={y - r * 1.1} stroke={color} strokeWidth={sw} />
        </>
      );
    case "outlet":
      return (
        <>
          <circle cx={x} cy={y} r={r} fill="#fff" stroke={color} strokeWidth={sw} />
          <line x1={x - r * 0.3} y1={y - r * 0.5} x2={x - r * 0.3} y2={y + r * 0.5} stroke={color} strokeWidth={sw} />
          <line x1={x + r * 0.3} y1={y - r * 0.5} x2={x + r * 0.3} y2={y + r * 0.5} stroke={color} strokeWidth={sw} />
        </>
      );
    case "toilet":
      return (
        <>
          <rect x={x - r * 0.5} y={y - r * 1.0} width={r} height={r * 0.5} fill="#fff" stroke={color} strokeWidth={sw} />
          <ellipse cx={x} cy={y + r * 0.15} rx={r * 0.75} ry={r * 0.85} fill="#fff" stroke={color} strokeWidth={sw} />
        </>
      );
    case "shower":
      return (
        <>
          <rect x={x - r} y={y - r} width={r * 2} height={r * 2} fill="#fff" stroke={color} strokeWidth={sw} />
          <line x1={x - r * 0.55} y1={y - r * 0.55} x2={x + r * 0.55} y2={y + r * 0.55} stroke={color} strokeWidth={sw} />
          <line x1={x - r * 0.55} y1={y + r * 0.55} x2={x + r * 0.55} y2={y - r * 0.55} stroke={color} strokeWidth={sw} />
        </>
      );
    case "sink":
      return (
        <>
          <rect x={x - r} y={y - r * 0.65} width={r * 2} height={r * 1.3} rx={r * 0.5} fill="#fff" stroke={color} strokeWidth={sw} />
          <circle cx={x} cy={y} r={r * 0.18} fill={color} />
        </>
      );
    case "drain":
      return (
        <>
          <rect x={x - r * 0.7} y={y - r * 0.7} width={r * 1.4} height={r * 1.4} fill="#fff" stroke={color} strokeWidth={sw} />
          <line x1={x - r * 0.5} y1={y - r * 0.5} x2={x + r * 0.5} y2={y + r * 0.5} stroke={color} strokeWidth={sw} />
          <line x1={x - r * 0.5} y1={y + r * 0.5} x2={x + r * 0.5} y2={y - r * 0.5} stroke={color} strokeWidth={sw} />
        </>
      );
    case "gate":
      return <path d={`M ${x - r} ${y} A ${r} ${r} 0 0 1 ${x} ${y - r}`} fill="none" stroke={color} strokeWidth={sw} />;
    default:
      return <circle cx={x} cy={y} r={r} fill="#fff" stroke={color} strokeWidth={sw} />;
  }
}
