import { wallLength, detectRooms, boundingBox, countStructuralNodes } from "./geometry";

const TIE_COLUMN_MAX_SPACING = 4.5; // m — midpoint of the researched 4-6m confined-masonry range
const TIMBER_STUD_SPACING = 0.4; // m — 400mm / 16" o.c., typical residential framing

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
  let stairCount = ensure("stairCount", "unit");
  let railingLength = ensure("railingLength", "m");
  let structuralConcreteVolume = ensure("structuralConcreteVolume", "m3");
  let structuralRebarWeight = ensure("structuralRebarWeight", "kg");
  let structuralSteelWeight = ensure("structuralSteelWeight", "kg");
  let tieColumnCount = ensure("tieColumnCount", "unit");
  let timberFramingLength = ensure("timberFramingLength", "m");

  const structuralSystem = project?.structuralSystem || "concrete";

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
      // timber stud framing: studs at fixed spacing, each spanning the wall height
      if (structuralSystem === "timber") {
        const studCount = Math.ceil(len / TIMBER_STUD_SPACING) + 1;
        const framingLen = studCount * h;
        timberFramingLength.value += framingLen;
        timberFramingLength.sources.push({ floor: fIdx, type: "wall", id: w.id, label: "Stud framing", value: framingLen });
      }
    });

    // confined-masonry tie-columns: at every corner/junction/dead-end, plus
    // extra ties along runs longer than the max recommended spacing
    if (structuralSystem === "masonry") {
      const nodeTies = countStructuralNodes(walls);
      tieColumnCount.value += nodeTies;
      tieColumnCount.sources.push({ floor: fIdx, type: "structure", id: `ties-nodes-${fIdx}`, label: "Tie-columns (corners/junctions)", value: nodeTies });
      walls.forEach((w) => {
        if (w.wallType === "fence") return;
        const extra = Math.floor(wallLength(w) / TIE_COLUMN_MAX_SPACING);
        if (extra > 0) {
          tieColumnCount.value += extra;
          tieColumnCount.sources.push({ floor: fIdx, type: "wall", id: w.id, label: "Tie-column (long run)", value: extra });
        }
      });
    }

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

    // stairs (footprint marker only — no floor-opening/void simulation)
    (floor.stairs || []).forEach((st) => {
      stairCount.value += 1;
      stairCount.sources.push({ floor: fIdx, type: "stair", id: st.id, label: "Stair", value: 1 });
    });

    // railings
    (floor.railings || []).forEach((rl) => {
      const len = wallLength({ start: rl.start, end: rl.end });
      railingLength.value += len;
      railingLength.sources.push({ floor: fIdx, type: "railing", id: rl.id, label: `Railing ${len.toFixed(2)}m`, value: len });
    });

    // custom items are priced directly in estimateEngine.js (manual entry
    // bypasses the quantity-rule system entirely — see its own comment)

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

  // Roof: for any roof made of planar sloped surfaces at a uniform pitch,
  // the horizontal projection of the total sloped area always equals the
  // footprint (a basic property of a height-field over a fixed base) — so
  // footprint/cos(pitch) is a good, non-arbitrary approximation for
  // shed/gable/hip roofs alike at a given pitch, reducing to just the
  // footprint (with overhang) when flat. This replaces the old flat x1.3
  // magic-number heuristic.
  const bld = project?.building || {};
  let footprint = (bld.length || 0) * (bld.width || 0);
  if (footprint <= 0) footprint = largestFloorArea;
  const roof = project?.roof || { type: "gable", pitchDeg: 30, overhang: 0.5 };
  const overhang = roof.overhang ?? 0.5;
  const overhangFootprint = (bld.length || 0) > 0 && (bld.width || 0) > 0
    ? (bld.length + overhang * 2) * (bld.width + overhang * 2)
    : footprint;
  const pitchRad = roof.type === "flat" ? 0 : ((roof.pitchDeg ?? 30) * Math.PI) / 180;
  roofArea.value = overhangFootprint / Math.cos(pitchRad);
  roofArea.sources = [{ floor: 0, type: "roof", id: "roof", label: `Roof (${roof.type}, ${roof.type === "flat" ? "0" : roof.pitchDeg}°)`, value: roofArea.value }];

  // Structural concrete/steel: quick-estimate coefficients (quantity-surveying
  // thumb rules, not a placed structural design) applied per floor's footprint.
  // Each figure is already a COMBINED column+beam+footing+slab (concrete) or
  // full-frame (steel) quantity, so no separate foundation/ring-beam category
  // is exposed for these two systems — that would double-count.
  const totalFloors = floors.length || 1;
  const structFootprint = footprint || largestFloorArea;
  if (structuralSystem === "concrete") {
    structuralConcreteVolume.value = structFootprint * totalFloors * 0.41;
    structuralConcreteVolume.sources = [{ floor: 0, type: "structure", id: "struct-concrete", label: `Structural concrete (${totalFloors} floor(s) x 0.41 m3/m2)`, value: structuralConcreteVolume.value }];
    structuralRebarWeight.value = structFootprint * totalFloors * 50;
    structuralRebarWeight.sources = [{ floor: 0, type: "structure", id: "struct-rebar", label: `Reinforcement (${totalFloors} floor(s) x 50 kg/m2)`, value: structuralRebarWeight.value }];
  } else if (structuralSystem === "steel") {
    const perM2 = totalFloors > 1 ? 25 : 18;
    structuralSteelWeight.value = structFootprint * totalFloors * perM2;
    structuralSteelWeight.sources = [{ floor: 0, type: "structure", id: "struct-steel", label: `Structural steel (${totalFloors} floor(s) x ${perM2} kg/m2)`, value: structuralSteelWeight.value }];
  }

  return {
    rules,
    rooms: allRooms,
    buildingArea: footprint || floorAreaTotal,
    floorAreaTotal,
  };
}
