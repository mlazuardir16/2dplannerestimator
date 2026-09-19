# PRD — 2D Floor Planner + Automatic RAB Estimator ("PlanCost")

## Original Problem Statement
Build a web-based application for residential house planning and automatic construction
cost estimation (RAB). Users (homeowners, contractors, architects, engineers, QS) draw a
2D floor plan and the drawing is automatically converted into quantities and a construction
cost estimate. The 2D drawing is the SINGLE SOURCE OF TRUTH for quantities/RAB. Modern,
clean, Canva-like tool (not AutoCAD). Worldwide use, English UI, default currency USD.

## User Choices
- Persistence: MongoDB backend (projects sync across devices).
- Scope of first build: Full Phase 1–11.
- Price data: complete starter dataset (USD base), editable.
- Locale: worldwide / English UI / USD default (currency configurable per project).
- Design: modern clean look (design_guidelines.json — Blueprint Cobalt palette, Plus Jakarta
  Sans / Inter / JetBrains Mono).

## Architecture
- Frontend: React 19 (CRA), zustand state, custom SVG canvas (grid via SVG patterns for perf),
  recharts, framer-motion, shadcn/ui, sonner.
- Backend: FastAPI + MongoDB (motor). Projects stored as flexible documents.
- Clean separation (as required): Geometry → Quantity → Construction Item → Resource → Price → RAB.
  - lib/geometry.js (walls, snapping, planar-face room detection)
  - lib/quantityEngine.js (computeQuantities)
  - lib/constructionItems.js (AHSP items + resource price DB, USD)
  - lib/rabEngine.js (computeRAB: rows/byCategory/subtotal/overhead/grandTotal)
- API: GET/POST /api/projects, GET/PUT/DELETE /api/projects/{id}. No auth.

## Data Model
Project { id, name, client, location, buildingType, land{length,width}, building{length,width},
  floorCount, currency, overheadPct, estimatedCost, buildingArea, itemsDb[], resourcesDb[],
  floors[] }
Floor { id, level, name, height, walls[], doors[], windows[], columns[], utilities[], roomNames{} }
Wall { id, start{x,y}, end{x,y}, thickness, height, material, wallType(exterior|interior|fence) }
Door/Window { id, wallId, t(0..1), width, height, (sill), type, material }
Column { id, x, y, width, depth, height }  Utility { id, kind, x, y }
Rooms are auto-detected from wall geometry (not stored); names persisted by centroid key.

## Implemented (2026-06)
- Dashboard: project cards w/ generated blueprint thumbnail, estimated cost, area, search, delete.
- New Project modal: blank or sample house; sets currency/floors/dimensions.
- Workspace: 2D SVG canvas — grid (major 1m/minor 0.1m), pan, zoom (8–400%), snap (grid + vertex magnet).
- Tools: select/move, draw wall (click-to-point, chained, Esc finish), door, window, column, utility, pan.
- Walls: create/select/move (body + endpoints)/edit thickness,height,type/delete; live dimensions.
- Rooms: auto-detected polygons w/ area + editable names.
- Doors/windows attached to walls (move with wall), deducted from wall area in quantities.
- Multi-floor: add/duplicate/switch floors + ghost reference layer of floor below.
- Undo/redo (history stack) for geometry mutations; keyboard shortcuts (v/w/d/n/c/u/h, Ctrl+Z/Shift, Ctrl+S, Del).
- Quantity engine + RAB table (grouped by category, AHSP breakdown drill-down, subtotal/overhead/grand total, CSV export, jump-to-drawing highlight).
- Cost Summary: metrics + category pie + material/labor/equipment bar + category breakdown bars.
- Price Database: editable resource unit rates + overhead % → live RAB recompute.
- Persistence: manual Save + 1.5s debounced autosave (PUT), estimatedCost/buildingArea snapshot for dashboard.

## Verified
- testing_agent iteration_1: backend 100% (8/8 pytest), frontend 100%. No console errors.

## Known Limitations
- Room detection uses planar face tracing on wall centerlines; disconnected/dangling walls or
  non-closed loops won't form rooms. Outer boundary excluded via signed-area heuristic.
- Roof area is approximated from building footprint × 1.3 slope factor; ring beam/foundation are
  approximations. AHSP coefficients are reasonable starter values, editable by the user.
- No authentication (single shared project space).
- 3D mode and AI floor-plan generation intentionally NOT implemented (future).

## Backlog / Next (P1/P2)
- P1: Editable project setup after creation (rename, dimensions, currency) in a settings panel.
- P1: PDF / Excel / image export of RAB and floor plan.
- P1: Wall-angle/ortho lock + numeric length entry while drawing.
- P2: AHSP coefficient editor UI (currently prices editable; coefficients editable via store only).
- P2: Room-by-room cost distribution chart.
- P2: AI floor-plan generation; 3D (BabylonJS) view.
