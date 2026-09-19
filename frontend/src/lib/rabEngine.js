import { computeQuantities } from "./quantityEngine";

// RAB engine: quantities -> construction items -> priced rows.
export function computeRAB(project) {
  const quantities = computeQuantities(project);
  const resources = project?.resourcesDb || [];
  const items = project?.itemsDb || [];
  const resMap = Object.fromEntries(resources.map((r) => [r.id, r]));

  const rows = items
    .map((item, idx) => {
      const rule = quantities.rules[item.rule];
      const base = rule ? rule.value : 0;
      const volume = base * (1 + (item.wasteFactor || 0));
      let material = 0;
      let labor = 0;
      let equipment = 0;
      const breakdown = (item.resources || []).map((rr) => {
        const r = resMap[rr.ref];
        const price = r ? r.price || 0 : 0;
        const cost = (rr.coef || 0) * price;
        if (r) {
          if (r.type === "labor") labor += cost;
          else if (r.type === "equipment") equipment += cost;
          else material += cost;
        }
        return {
          ref: rr.ref,
          name: r ? r.name : rr.ref,
          type: r ? r.type : "material",
          unit: r ? r.unit : "",
          coef: rr.coef || 0,
          price,
          cost,
        };
      });
      const unitCost = material + labor + equipment;
      return {
        no: idx + 1,
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        rule: item.rule,
        wasteFactor: item.wasteFactor || 0,
        volume,
        unitCost,
        materialUnit: material,
        laborUnit: labor,
        equipmentUnit: equipment,
        materialCost: material * volume,
        laborCost: labor * volume,
        equipmentCost: equipment * volume,
        total: unitCost * volume,
        breakdown,
        sources: rule ? rule.sources : [],
      };
    })
    .filter((r) => r.volume > 0.0001);

  const byCategory = {};
  let subtotal = 0;
  let materialTotal = 0;
  let laborTotal = 0;
  let equipmentTotal = 0;
  rows.forEach((r) => {
    subtotal += r.total;
    materialTotal += r.materialCost;
    laborTotal += r.laborCost;
    equipmentTotal += r.equipmentCost;
    if (!byCategory[r.category]) byCategory[r.category] = { total: 0, rows: [] };
    byCategory[r.category].total += r.total;
    byCategory[r.category].rows.push(r);
  });

  const overheadPct = project?.overheadPct ?? 10;
  const overhead = (subtotal * overheadPct) / 100;
  const grandTotal = subtotal + overhead;

  const buildingArea = quantities.buildingArea || 0;
  const costPerM2 = buildingArea > 0 ? grandTotal / buildingArea : 0;

  return {
    rows,
    byCategory,
    subtotal,
    overhead,
    overheadPct,
    grandTotal,
    materialTotal,
    laborTotal,
    equipmentTotal,
    buildingArea,
    floorAreaTotal: quantities.floorAreaTotal,
    costPerM2,
    quantities,
  };
}
