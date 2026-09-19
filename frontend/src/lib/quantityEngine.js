import { wallLength, detectRooms, boundingBox } from "./geometry";

// Central quantity takeoff engine: geometry -> quantities.
// Returns { rules: { ruleId: { value, unit, sources:[] } }, buildingArea, floorAreaTotal, rooms }
export function computeQuantities(project) {
  const floors = project?.floors || [];
  const rules = {};
  const ensure = (id, unit) => {
    if (!rules[id]) rules[id] = { value: 0, unit, sources: [] };
    return rules[id];
  };

  let wallArea = ensure("wallArea", "m2");
  let plasterArea = ensure("plasterArea", "m2");
  let paintArea = ensure("paintArea", "m2");
  let floorArea = ensure("floorArea", "m2");
  let ceilingArea = ensure("ceilingArea", "m2");
  let roofArea = ensure("roofArea", "m2");
  let foundationLength = ensure("foundationLength", "m");
  let columnVolume = ensure("columnVolume", "m3");
  let beamVolume = ensure("beamVolume", "m3");
  let doorCount = ensure("doorCount", "unit");
  let windowCount = ensure("windowCount", "unit");
  let lampCount = ensure("lampCount", "unit");
  let switchCount = ensure("switchCount", "unit");
  let outletCount = ensure("outletCount", "unit");
  let toiletCount = ensure("toiletCount", "unit");
  let showerCount = ensure("showerCount", "unit");
  let sinkCount = ensure("sinkCount", "unit");
  let drainCount = ensure("drainCount", "unit");
  let fenceLength = ensure("fenceLength", "m");
  let gateCount = ensure("gateCount", "unit");

  const allRooms = [];
  let floorAreaTotal = 0;
  let largestFloorArea = 0;

  floors.forEach((floor, fIdx) => {
    const walls = floor.walls || [];
    const doors = floor.doors || [];
    const windows = floor.windows || [];
    const height = floor.height || 3.2;

    // openings area per wall
    const openingByWall = {};
    doors.forEach((d) => {
      openingByWall[d.wallId] = (openingByWall[d.wallId] || 0) + (d.width || 0) * (d.height || 0);
    });
    windows.forEach((w) => {
      openingByWall[w.wallId] = (openingByWall[w.wallId] || 0) + (w.width || 0) * (w.height || 0);
    });

    let floorRoomArea = 0;
    walls.forEach((w) => {
      const len = wallLength(w);
      const h = w.height || height;
      if (w.wallType === "fence") {
        fenceLength.value += len;
        fenceLength.sources.push({ floor: fIdx, type: "wall", id: w.id, label: "Fence segment", value: len });
        return;
      }
      const gross = len * h;
      const net = Math.max(0, gross - (openingByWall[w.id] || 0));
      wallArea.value += net;
      wallArea.sources.push({ floor: fIdx, type: "wall", id: w.id, label: `Wall ${len.toFixed(2)}m`, value: net });
      // ring beam approx 0.15 x 0.20 section along wall
      beamVolume.value += len * 0.15 * 0.2;
      beamVolume.sources.push({ floor: fIdx, type: "wall", id: w.id, label: "Ring beam", value: len * 0.03 });
      // foundation only on ground floor
      if (fIdx === 0) {
        foundationLength.value += len;
        foundationLength.sources.push({ floor: fIdx, type: "wall", id: w.id, label: "Foundation", value: len });
      }
    });

    // rooms
    const rooms = detectRooms(walls);
    rooms.forEach((r) => {
      floorRoomArea += r.area;
      floorArea.sources.push({ floor: fIdx, type: "room", id: r.id, label: "Room", value: r.area });
      allRooms.push({ ...r, floor: fIdx });
    });
    floorArea.value += floorRoomArea;
    floorAreaTotal += floorRoomArea;
    largestFloorArea = Math.max(largestFloorArea, floorRoomArea);

    // columns
    (floor.columns || []).forEach((c) => {
      const vol = (c.width || 0.15) * (c.depth || 0.15) * (c.height || height);
      columnVolume.value += vol;
      columnVolume.sources.push({ floor: fIdx, type: "column", id: c.id, label: "Column", value: vol });
    });

    // openings counts
    doors.forEach((d) => {
      doorCount.value += 1;
      doorCount.sources.push({ floor: fIdx, type: "door", id: d.id, label: "Door", value: 1 });
    });
    windows.forEach((w) => {
      windowCount.value += 1;
      windowCount.sources.push({ floor: fIdx, type: "window", id: w.id, label: "Window", value: 1 });
    });

    // utilities
    (floor.utilities || []).forEach((u) => {
      const map = {
        lamp: lampCount,
        switch: switchCount,
        outlet: outletCount,
        toilet: toiletCount,
        shower: showerCount,
        sink: sinkCount,
        drain: drainCount,
        gate: gateCount,
      };
      const bucket = map[u.kind];
      if (bucket) {
        bucket.value += 1;
        bucket.sources.push({ floor: fIdx, type: "utility", id: u.id, label: u.kind, value: 1 });
      }
    });
  });

  // derived
  plasterArea.value = wallArea.value * 2;
  plasterArea.sources = wallArea.sources.map((s) => ({ ...s, value: s.value * 2 }));
  paintArea.value = wallArea.value * 2;
  paintArea.sources = plasterArea.sources;
  ceilingArea.value = floorArea.value;
  ceilingArea.sources = floorArea.sources;

  // roof: building footprint (or largest floor) * slope factor 1.3
  const bld = project?.building || {};
  let footprint = (bld.length || 0) * (bld.width || 0);
  if (footprint <= 0) footprint = largestFloorArea;
  roofArea.value = footprint * 1.3;
  roofArea.sources = [{ floor: 0, type: "roof", id: "roof", label: "Roof footprint x slope", value: roofArea.value }];

  return {
    rules,
    rooms: allRooms,
    buildingArea: footprint || floorAreaTotal,
    floorAreaTotal,
  };
}
