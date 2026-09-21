// Generic, unit-agnostic purchase-quantity math. It works off whatever
// coverage/coverageUnit/normalizedUnit a given material carries — there are
// no hardcoded national coefficients or standards baked in here (that's
// exactly the AHSP approach this feature replaces). Figuring out which
// measurement/packaging convention a given country actually uses per
// category is future work for the research provider; this module only
// needs a material shaped like NormalizedMaterial.
export function computePurchase(material, quantityNeeded, wasteFactor = 0) {
  const effectiveQty = Math.max(0, quantityNeeded || 0) * (1 + (wasteFactor || 0));
  const normalizedPrice = material?.normalizedPrice || 0;
  const sourcePrice = material?.sourcePrice || 0;
  const theoreticalCost = effectiveQty * normalizedPrice;

  const hasCoverage = !!material?.coverage && material.coverage > 0;
  const packagesNeeded = hasCoverage
    ? Math.ceil(effectiveQty / material.coverage)
    : Math.ceil(effectiveQty);
  const purchaseCost = packagesNeeded * sourcePrice;

  return {
    effectiveQty,
    packagesNeeded,
    purchaseCost,
    theoreticalCost,
    effectiveUnitCost: normalizedPrice,
    coverageMissing: !hasCoverage,
  };
}
