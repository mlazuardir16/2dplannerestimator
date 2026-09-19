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
  const addWall = useProjectStore((s) => s.addWall);
  const addDoor = useProjectStore((s) => s.addDoor);
  const addWindow = useProjectStore((s) => s.addWindow);
  const addColumn = useProjectStore((s) => s.addColumn);
  const addUtility = useProjectStore((s) => s.addUtility);
  const updateWallRaw = useProjectStore((s) => s.updateWallRaw);
  const updateColumnRaw = useProjectStore((s) => s.updateColumnRaw);
  const updateUtilityRaw = useProjectStore((s) => s.updateUtilityRaw);
  const updateOpeningRaw = useProjectStore((s) => s.updateOpeningRaw);
  const beginHistory = useProjectStore((s) => s.beginHistory);
  const deleteElement = useProjectStore((s) => s.deleteElement);

  const floor = project?.floors?.[activeFloor];
  const walls = floor?.walls || [];
  const highlightSet = useMemo(() => new Set(highlightIds), [highlightIds]);

  const rooms = useMemo(() => detectRooms(walls), [walls]);

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

  const snap = useCallback(
    (p) => {
      // vertex magnet first
      if (grid.snap) {
        const thr = 0.25;
        let best = null;
        for (const w of walls) {
          for (const v of [w.start, w.end]) {
            const d = dist(p, v);
            if (d < thr && (!best || d < best.d)) best = { d, v };
          }
        }
        if (best) return { x: best.v.x, y: best.v.y };
        const step = grid.minor;
        return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
      }
      return p;
    },
    [grid, walls]
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
    } else if (d.mode === "opening") {
      // move opening along its wall
      const wall = walls.find((x) => x.id === d.wallId);
      if (wall) {
        const r = pointToSegment(world, wall.start, wall.end);
        updateOpeningRaw(d.kind, d.id, { t: r.t });
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
      if (e.key === "Escape") setPreview(null);
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

          {/* utilities */}
          {floor.utilities.map((u) => {
            const isSel = selected?.type === "utility" && selected.id === u.id;
            const r = 0.16;
            return (
              <g key={u.id} style={{ pointerEvents: tool === "select" ? "auto" : "none", cursor: "move" }} onPointerDown={(e) => onUtilDown(e, u)}>
                <circle cx={u.x} cy={u.y} r={r} fill="#fff" stroke={isSel ? "#2563EB" : utilColor(u.kind)} strokeWidth={2.5 / s} />
                <text x={u.x} y={u.y + smallFont * 0.35} textAnchor="middle" fontSize={smallFont} fontWeight="700" fill={utilColor(u.kind)}>
                  {u.kind.charAt(0).toUpperCase()}
                </text>
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
