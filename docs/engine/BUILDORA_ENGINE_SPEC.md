# Buildora — RAB Engine Specification v1.1

Source of truth: the two reference workbooks in this folder (`Buildora_RAB_Tipe36.xlsx`, `Buildora_RAB_2Lantai_LB108.xlsx`) and `buildora_engine_seed.json`. The engine must reproduce the workbook totals exactly (golden tests, §6).

## 1. Scope
Input: a house template (dimensions → volumes), a region (DKI Jakarta for v1), a spec class (Sederhana / Menengah / Mewah), and editable prices, wages and coefficients.
Output: RAB Swakelola, RAB Borongan, material list (purchase packs + cost), labor per stage and trade, schedule + S-curve, price-per-m² control.

## 2. Data model (see seed JSON)
| Entity | Fields |
|---|---|
| Material | code, name, spec, pack (e.g. "zak 40 kg"), pack_size (in base unit), base_unit, price_per_pack, waste (0–0.10), source, reference ("Harga acuan" / "Estimasi"), bulk (1 = delivered price, e.g. sand per truck) |
| LaborRate | code (PKJ, TKG, TKY, TBS, TCT, TLS, TPP, KTK, MDR), name, rate per day |
| WorkItem | group (stage I–XIII), name, volume (template key or fixed number), unit, materials {code: coefficient per unit}, labor_OH {trade: OH per unit}, installed_package_price (null unless item is bought installed), reference, item_type ("Standar" / "Tambahan") |
| Template | volume parameters (inputs) + derived volume formulas (Excel syntax, keys refer to other volume keys) |
| Parameters | margin 15%, contingency 10% swakelola / 5% borongan, delivery 3% of non-bulk material cost (swakelola only), PKP switch + PPN 11% effective, PPN KMS 2.2% when area ≥ 200 m², crew size (1 lantai 5, 2 lantai 8), 6 workdays/week |
| PriceRange | per m² borongan by class + labor-only (borongan jasa) range |

Notes:
- Labor OH coefficients in the seed are already market-calibrated (factors in `labor_calibration_factors_applied_in_coefficients`). Do not apply them again.
- Material coefficients exclude waste; waste is applied from the material record.
- Derived volume formulas use the workbook's cell references (`Volume!$B$n`). Inputs fill rows 6 onward in seed order, and the derived block starts after one blank row below the last input. For example, in Tipe 36, `Volume!$B$23` is `A`.
- Installed packages (baja ringan, aluminium doors/windows, septictank, kanopi, pagar, gate, lisplang, waterproofing, railing) have labor = 0: the package price includes installation.

## 3. Calculation
Effective coefficients — as stored in the workbook's AHSP sheet. **Every cost and quantity below uses these, never the raw seed values**:
- `coef_eff(m) = round(coef(m) × (1 + waste(m)), 5)` — material coefficient including waste, 5 decimals
- `OH_eff(t) = round(OH(t), 4)` — labour coefficient, 4 decimals
- Rounding is Python `round()` on the binary float, not Excel `ROUND`. For example, `0.22945` rounds to `0.2294`, whereas Excel would give `0.2295`. All 612 coefficients in the two workbooks follow this rule.
- Money is never rounded. Unit prices, line totals, material costs and wages keep full precision.

Per item (unit prices):
- `price_base(m) = price_per_pack(m) / pack_size(m)`
- `bahan_unit = Σ coef_eff(m) × price_base(m)`, or `installed_package_price` for packages
- `upah_unit = Σ OH_eff(t) × rate(t)`
- `margin_unit = (bahan_unit + upah_unit) × margin` (borongan only)
- Line totals = volume × unit price. Stage totals = Σ lines.

Swakelola total:
1. `subtotal = Σ(bahan + upah) + delivery`, with `delivery = 3% × Σ material_cost(m) for non-bulk materials`
2. `+ contingency 10% × subtotal`
3. `+ PPN KMS 2.2% × (subtotal + contingency)` only if building area ≥ 200 m²

Borongan total:
1. `subtotal = Σ(bahan + upah + margin)` (delivery is covered by the margin)
2. `+ contingency 5% × subtotal`
3. `+ PPN 11% × (subtotal + contingency)` only if contractor is PKP

Materials:
- `qty(m) = Σ_items volume × coef_eff(m)` (installed packages contribute no materials)
- `packs(m) = max(0, ceil(qty / pack_size − 0.0001))` — shopping guide only; the 0.0001 tolerance avoids buying an extra pack for a rounding crumb
- `material_cost(m) = qty × price_base` — used in totals (no pack rounding)

Labor:
- `OH(stage, trade) = Σ volume × OH_eff`; `upah = OH × rate`. No day rounding anywhere in cost.

Schedule:
- `days(stage) = ceil(Σ OH(stage) / crew)` (0 when the stage has no OH), `weeks = max(1, ceil(days / 6))`
- Stages run in sequence: each stage starts the week after the stage listed before it ends.
- Exception: X (plumbing) and XI (electrical) start in the same week as IX (paint).
- XII therefore starts the week after **XI** ends, even if IX is still running. The workbook's Kurva-S sheet does this (`C16 = C15 + D15`). For 2 lantai, IX takes 2 weeks and XI takes 1, so XII overlaps IX's second week and the total is 24 weeks, not 25.
- `duration_weeks = max(start + weeks) − 1` over all stages.
- S-curve weights = stage borongan cost ÷ Σ stage borongan cost (before contingency and tax). Planned progress is spread evenly over each stage's weeks. Actual = Σ weight × user-entered stage % (cumulative).
- Status: TERLAMBAT if deviation < −5%, LEBIH CEPAT if > +5%, otherwise SESUAI RENCANA.

Price-per-m² control (standard items only):
- `per_m2_borongan = Σ JUMLAH(items with item_type = Standar) / building_area`, checked against the class range
- Swakelola: same sum without margin, checked against `range / (1 + margin)`
- Labor: `Σ upah(Standar) × (1 + margin) / area`, checked against the borongan jasa range
- Status (exact text):
  - `Dalam rentang pasar`
  - `Di bawah rentang (x%) — periksa apakah ada pekerjaan/spesifikasi yang terlewat`, with x = value ÷ minimum − 1
  - `Di atas rentang (+x%) — periksa spesifikasi atau harga yang terlalu tinggi`, with x = value ÷ maximum − 1
  - x is a whole percent rounded half away from zero (Excel `TEXT(…, "0%")`), e.g. `-9%`
- Tambahan (excluded): stage XII (dapur), XIII (carport, kanopi, pagar, gate), toren, pompa air, shower set; also delivery, contingency, tax.

## 4. Business rules (decided)
- One output document: RAB Swakelola and RAB Borongan as separate sheets, plus Rekap, Kontrol Harga, Perhitungan Bahan, Perhitungan Upah, AHSP (standard Permen PUPR form), Kurva-S, Volume, Parameter.
- Material, upah and margin are always shown separately; margin is stated with its %.
- Every price, wage, coefficient and volume input is user-editable; all outputs recalculate.
- Prices without a direct source are kept but labelled "Estimasi" and excluded from the "sesuai harga acuan" badge.
- Shop links only for online merchants (Tokopedia, ruparupa, Shopee, Lazada…); knowledge sources are named, not linked. bangun.com is credited wherever its data is used.
- Structure output is always labelled an estimate.

## 5. Excel export
Replicate the reference workbook: sheet order, column headings ("Tipe item", "Referensi"), colour legend (yellow = editable input, green = linked, orange = Estimasi), live formulas, zero formula errors.

## 6. Golden tests (DKI Jakarta, Sep 2026 prices, Menengah) — tolerance ±Rp1
| Template | Swakelola | Borongan | Per m² standar (borongan) | Upah total | Weeks |
|---|---|---|---|---|---|
| Tipe 36/72, 1 lantai | 225,677,253 | 244,786,045 | 5,342,826 | 55,534,640 | 18 |
| 2 lantai LB 108 | 516,601,137 | 559,217,347 | 4,548,590 | 141,133,453 | 24 |
Edit tests (Tipe 36): granit +Rp20.000/dus → swakelola +589,042, borongan +627,774; pekerja +Rp10.000/day → borongan +2,481,032 (2 lantai: +6,307,894); margin 15%→20% → borongan +10,642,872 (2 lantai: +24,313,798).

## 7. Open items
- AHSP standard coefficients were written from memory of AHSP/SNI — verify against the official Permen PUPR 8/2023 appendix.
- Missing standard items: gutters & downpipes, bak kontrol & drainage, sumur resapan, AC power points, exhaust fans, lightning rod (Tambahan: water heater, AC units).
- Region pricing: DKI only in v1; other regions via the province/kab-kota factors in Database Harga v3.
- Ready-mix concrete + pump as an alternative to site-mix.

## 8. Changelog
- **v1.1 (2026-10-02):** Wrote in the workbook behaviour that the golden values depend on:
  - effective coefficients (OH to 4 decimals, material coefficient including waste to 5 decimals)
  - the XII-after-XI scheduling rule
  - the pack tolerance
  - exact status texts, including SESUAI RENCANA
  - the Volume-sheet row layout

  The calculation and the golden values are unchanged.
