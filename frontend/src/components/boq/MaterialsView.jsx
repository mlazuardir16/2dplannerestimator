import { useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/store/useProjectStore";
import { computeQuantities } from "@/lib/quantityEngine";
import { MATERIAL_CATEGORIES, getActiveCategoryOrder, STRUCTURAL_SYSTEMS } from "@/lib/materialCategories";
import { findMaterials } from "@/lib/materialProvider";
import { COUNTRIES } from "@/lib/countries";
import { formatMoney, fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const CONFIDENCE_STYLE = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-red-100 text-red-700",
};

export default function MaterialsView() {
  const project = useProjectStore((s) => s.project);
  const setCountry = useProjectStore((s) => s.setCountry);
  const selectMaterial = useProjectStore((s) => s.selectMaterial);
  const setRoofConfig = useProjectStore((s) => s.setRoofConfig);
  const setStructuralSystem = useProjectStore((s) => s.setStructuralSystem);
  const categoryOrder = useMemo(() => getActiveCategoryOrder(project), [project]);

  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const prevCountry = useRef(project.country);

  // Search results (and any prior selections) are specific to one country's
  // market — a country change clears selections at the store level, and the
  // local search-results cache needs to follow suit here.
  useEffect(() => {
    if (prevCountry.current && prevCountry.current !== project.country) {
      setResults({});
      toast.info("Country changed — previous material selections were cleared.");
    }
    prevCountry.current = project.country;
  }, [project.country]);

  const quantities = useMemo(() => computeQuantities(project), [project]);

  const search = async (catKey) => {
    const catMeta = MATERIAL_CATEGORIES[catKey];
    const qty = quantities.rules[catMeta.rule]?.value || 0;
    setLoading((l) => ({ ...l, [catKey]: true }));
    try {
      const materials = await findMaterials({
        country: project.country,
        category: catKey,
        quantity: qty,
        unit: catMeta.unit,
      });
      setResults((r) => ({ ...r, [catKey]: materials }));
      if (!materials.length) toast.info(`No materials found for ${catMeta.label} yet`);
    } catch (e) {
      console.error(e);
      toast.error("Material search failed");
    } finally {
      setLoading((l) => ({ ...l, [catKey]: false }));
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-6 py-6" data-testid="materials-view">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">Local Materials</h2>
            <p className="text-sm text-slate-500">
              Pick a country, find real local materials for each category, and select the ones you want.
            </p>
          </div>
          <div className="w-56 shrink-0">
            <div className="mb-1 text-xs font-medium text-slate-500">Country</div>
            <Select value={project.country || ""} onValueChange={setCountry}>
              <SelectTrigger data-testid="materials-country-select">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <StructuralSystemConfig system={project.structuralSystem} onChange={setStructuralSystem} />

        <div className="space-y-5">
          {categoryOrder.map((catKey) => {
            const catMeta = MATERIAL_CATEGORIES[catKey];
            const qty = quantities.rules[catMeta.rule]?.value || 0;
            const selected = project.materialSelections?.[catKey];
            const options = results[catKey];
            const isLoading = loading[catKey];
            return (
              <div key={catKey} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-semibold text-slate-900">{catMeta.label}</h3>
                    <p className="font-mono text-xs text-slate-500">
                      {fmtNum(qty)} {catMeta.unit} needed
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading || qty <= 0 || !project.country}
                    onClick={() => search(catKey)}
                    data-testid={`materials-search-${catKey}`}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-1.5 h-4 w-4" />
                    )}
                    Find local materials
                  </Button>
                </div>

                {catKey === "roofing" && (
                  <RoofConfig roof={project.roof} onChange={setRoofConfig} />
                )}

                {qty <= 0 && (
                  <div className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
                    Draw the relevant elements on the Floor Plan first to unlock this category.
                  </div>
                )}

                {selected && (
                  <div className="mb-3 flex items-center justify-between rounded-lg border border-[#1E56A0]/30 bg-[#EFF6FF] px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 text-[#1E56A0]">
                      <CheckCircle2 className="h-4 w-4" /> Selected: <b>{selected.materialName}</b>
                    </span>
                    <span className="font-mono text-slate-600">
                      {formatMoney(selected.normalizedPrice, selected.currency)}/{selected.normalizedUnit}
                    </span>
                  </div>
                )}

                {options && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {options.length === 0 && (
                      <div className="col-span-full py-6 text-center text-sm text-slate-400">
                        No materials found for this country/category yet.
                      </div>
                    )}
                    {options.map((m) => (
                      <MaterialCard
                        key={m.id}
                        material={m}
                        catKey={catKey}
                        onSelect={() => selectMaterial(catKey, m)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const ROOF_TYPES = [
  { id: "flat", label: "Flat" },
  { id: "shed", label: "Shed / Mono-pitch" },
  { id: "gable", label: "Gable" },
  { id: "hip", label: "Hip" },
];

function RoofConfig({ roof, onChange }) {
  const cfg = roof || { type: "gable", pitchDeg: 30, overhang: 0.5 };
  const isFlat = cfg.type === "flat";
  return (
    <div className="mb-3 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
      <div>
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Roof Shape</div>
        <Select value={cfg.type} onValueChange={(v) => onChange({ type: v })}>
          <SelectTrigger data-testid="roof-type-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROOF_TYPES.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Pitch (°)</div>
        <input
          type="number" min="0" max="60" step="1" disabled={isFlat} value={isFlat ? 0 : cfg.pitchDeg}
          onChange={(e) => onChange({ pitchDeg: Number(e.target.value) || 0 })}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-50"
        />
      </div>
      <div>
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Eave Overhang (m)</div>
        <input
          type="number" min="0" max="2" step="0.1" value={cfg.overhang}
          onChange={(e) => onChange({ overhang: Number(e.target.value) || 0 })}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        />
      </div>
    </div>
  );
}

function StructuralSystemConfig({ system, onChange }) {
  const current = STRUCTURAL_SYSTEMS.find((s) => s.id === system) || STRUCTURAL_SYSTEMS[0];
  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-display text-base font-semibold text-slate-900">Structural System</h3>
      <p className="mb-3 text-xs text-slate-500">
        Structural quantities are quick-estimate coefficients from quantity-surveying practice, not a placed structural design — always have a qualified engineer verify before construction.
      </p>
      <div className="max-w-xs">
        <Select value={system || "concrete"} onValueChange={onChange}>
          <SelectTrigger data-testid="structural-system-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STRUCTURAL_SYSTEMS.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">{current.blurb}</p>
    </div>
  );
}

function MaterialCard({ material: m, catKey, onSelect }) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-slate-200 p-3">
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-800">{m.materialName}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
              CONFIDENCE_STYLE[m.confidence] || CONFIDENCE_STYLE.medium
            }`}
          >
            {m.confidence}
          </span>
        </div>
        <div className="font-mono text-sm text-slate-900">
          {formatMoney(m.normalizedPrice, m.currency)} / {m.normalizedUnit}
        </div>
        <div className="font-mono text-xs text-slate-400">
          {formatMoney(m.sourcePrice, m.currency)} / {m.sourceUnit}
          {m.coverage ? ` · ${fmtNum(m.coverage)} ${m.coverageUnit}` : ""}
        </div>
        {/* Trust the backend's own confidence signal rather than re-deriving
            "does coverage matter for this category" on the frontend — the
            provider only downgrades confidence for missing coverage on
            area/volume-sold materials in the first place (see
            backend/materials/provider.py validate_product_data). */}
        {!m.coverage && m.confidence !== "high" && (
          <Warning text="Package coverage could not be verified." />
        )}
        {m.note && <Warning text={m.note} />}
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            {m.sourceName} · {m.sourceDate}
          </span>
          {m.sourceUrl && (
            <a
              href={m.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-0.5 text-[#1E56A0] hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Source
            </a>
          )}
        </div>
      </div>
      <Button
        size="sm"
        className="mt-3 bg-[#1E56A0] hover:bg-[#163E75]"
        onClick={onSelect}
        data-testid={`materials-select-${catKey}-${m.id}`}
      >
        Select
      </Button>
    </div>
  );
}

function Warning({ text }) {
  return (
    <div className="mt-1 flex items-start gap-1 text-[11px] text-amber-600">
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {text}
    </div>
  );
}
