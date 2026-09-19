// Pure geometry helpers. World units are meters.

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function wallLength(wall) {
  return dist(wall.start, wall.end);
}

export function snapValue(v, step) {
  return Math.round(v / step) * step;
}

export function snapPoint(p, step) {
  return { x: snapValue(p.x, step), y: snapValue(p.y, step) };
}

// Distance from point p to segment ab, plus the projected parameter t in [0,1].
export function pointToSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + t * abx, y: a.y + t * aby };
  return { distance: dist(p, proj), t, point: proj };
}

// Return the wall nearest to point within threshold (meters).
export function nearestWall(walls, p, threshold = 0.4) {
  let best = null;
  for (const w of walls) {
    const r = pointToSegment(p, w.start, w.end);
    if (r.distance <= threshold && (!best || r.distance < best.distance)) {
      best = { wall: w, t: r.t, distance: r.distance, point: r.point };
    }
  }
  return best;
}

export function pointOnWall(wall, t) {
  return {
    x: wall.start.x + (wall.end.x - wall.start.x) * t,
    y: wall.start.y + (wall.end.y - wall.start.y) * t,
  };
}

export function wallAngle(wall) {
  return Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
}

export function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return a / 2; // signed
}

export function polygonPerimeter(pts) {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    p += dist(pts[i], pts[j]);
  }
  return p;
}

export function polygonCentroid(pts) {
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const cross = pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    a += cross;
    x += (pts[i].x + pts[j].x) * cross;
    y += (pts[i].y + pts[j].y) * cross;
  }
  a = a / 2;
  if (Math.abs(a) < 1e-9) {
    // fallback: average
    const ax = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const ay = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return { x: ax, y: ay };
  }
  return { x: x / (6 * a), y: y / (6 * a) };
}

// Detect enclosed rooms from wall centerlines using planar half-edge face tracing.
// Returns array of { id, polygon:[{x,y}], area, perimeter, centroid }.
export function detectRooms(walls, minArea = 0.5) {
  const tol = 0.02; // 2 cm snapping for nodes
  const nodes = [];
  const nodeMap = new Map();
  const keyOf = (p) => `${Math.round(p.x / tol)},${Math.round(p.y / tol)}`;
  function getNode(p) {
    const k = keyOf(p);
    if (nodeMap.has(k)) return nodeMap.get(k);
    const id = nodes.length;
    nodes.push({ x: p.x, y: p.y });
    nodeMap.set(k, id);
    return id;
  }

  const adj = new Map();
  function addEdge(a, b) {
    if (a === b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  }
  for (const w of walls) {
    addEdge(getNode(w.start), getNode(w.end));
  }

  const sorted = new Map();
  adj.forEach((set, n) => {
    const arr = [...set].map((m) => ({
      m,
      ang: Math.atan2(nodes[m].y - nodes[n].y, nodes[m].x - nodes[n].x),
    }));
    arr.sort((p, q) => p.ang - q.ang);
    sorted.set(n, arr);
  });

  function nextHalfEdge(u, v) {
    const arr = sorted.get(v);
    if (!arr || arr.length === 0) return u;
    const idx = arr.findIndex((e) => e.m === u);
    if (idx === -1) return u;
    const ni = (idx - 1 + arr.length) % arr.length;
    return arr[ni].m;
  }

  const visited = new Set();
  const faces = [];
  adj.forEach((set, u) => {
    set.forEach((v) => {
      const key = u + "_" + v;
      if (visited.has(key)) return;
      const face = [];
      let cu = u;
      let cv = v;
      let guard = 0;
      while (guard < 100000) {
        visited.add(cu + "_" + cv);
        face.push(cu);
        const w = nextHalfEdge(cu, cv);
        cu = cv;
        cv = w;
        guard++;
        if (cu === u && cv === v) break;
      }
      if (face.length >= 3) faces.push(face);
    });
  });

  const rooms = [];
  faces.forEach((f, i) => {
    const pts = f.map((id) => ({ x: nodes[id].x, y: nodes[id].y }));
    const signed = polygonArea(pts);
    // Interior bounded faces carry positive signed area with this traversal.
    if (signed > minArea) {
      rooms.push({
        id: "room_" + i,
        polygon: pts,
        area: Math.abs(signed),
        perimeter: polygonPerimeter(pts),
        centroid: polygonCentroid(pts),
      });
    }
  });
  return rooms;
}

// stable-ish key for a room based on rounded centroid (used to persist room names)
export function roomKey(centroid) {
  return `${Math.round(centroid.x * 2) / 2},${Math.round(centroid.y * 2) / 2}`;
}

export function boundingBox(walls) {
  if (!walls.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const w of walls) {
    for (const p of [w.start, w.end]) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
