import { computeQuantities } from "./quantityEngine";
import { MATERIAL_CATEGORIES, getActiveCategoryOrder, roofWasteFactor } from "./materialCategories";
import { computePurchase } from "./purchaseMath";

// Estimate engine: quantities + selected local materials -> priced rows.
// Emits the same aggregate shape rabEngine.computeRAB used to (pre-rewrite),
// so CostSummary.jsx needs no changes.
export function computeEstimate(project) {
  const quantities = computeQuantities(project);
  const selections = project?.materialSelections || {};

  const materialRows = getActiveCategoryOrder(project).map((catKey) => {
    const catMeta = MATERIAL_CATEGORIES[catKey];
    const rule = quantities.rules[catMeta.rule];
    const qty = rule ? rule.value : 0;
    const material = selections[catKey];
    if (!material || qty <= 0.0001) return null;

    const defaultWaste = catKey === "roofing" ? roofWasteFactor(project?.roof?.type) : catMeta.defaultWasteFactor;
    const waste = material.wasteFactorOverride ?? material.recommendedWasteFactor ?? defaultWaste ?? 0;
    const purchase = computePurchase(material, qty, waste);

    return {
      id: catKey,
      name: material.materialName,
      category: catKey,
      unit: catMeta.unit,
      rule: catMeta.rule,
      wasteFactor: waste,
      volume: qty,
      unitCost: purchase.effectiveUnitCost,
      materialUnit: purchase.effectiveUnitCost,
      laborUnit: 0,
      equipmentUnit: 0,
      materialCost: purchase.purchaseCost,
      laborCost: 0,
      equipmentCost: 0,
      total: purchase.purchaseCost,
      sources: rule ? rule.sources : [],
      material,
      purchase,
      isCustom: false,
    };
  }).filter(Boolean);

  // Custom items bypass the quantity-rule/material-research system entirely
  // — they're manually named/unit'd/quantified/priced by the user (see
  // store/useProjectStore.js addCustomPoint/addCustomLine). Faked into the
  // same row shape so they flow through the aggregation below unchanged.
  const customRows = [];
  (project?.floors || []).forEach((floor, fIdx) => {
    (floor.customItems || []).forEach((item) => {
      const qty = item.quantity || 0;
      const unitPrice = item.unitPrice || 0;
      customRows.push({
        id: item.id,
        name: item.name || "Custom Item",
        category: "custom",
        unit: item.unit || "unit",
        rule: null,
        wasteFactor: 0,
        volume: qty,
        unitCost: unitPrice,
        materialUnit: unitPrice,
        laborUnit: 0,
        equipmentUnit: 0,
        materialCost: qty * unitPrice,
        laborCost: 0,
        equipmentCost: 0,
        total: qty * unitPrice,
        sources: [{ floor: fIdx, type: item.kind, id: item.id, label: item.name, value: qty }],
        material: null,
        purchase: null,
        isCustom: true,
      });
    });
  });

  const rows = [...materialRows, ...customRows].map((r, i) => ({ ...r, no: i + 1 }));

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

  const overheadPct = project?.estimateSettings?.overheadPct ?? project?.overheadPct ?? 10;
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
