import { useMemo, useState } from "react";
import { useProjectStore } from "@/store/useProjectStore";
import { CATEGORY_META } from "@/lib/constructionItems";
import { formatMoney, fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Crosshair, ListOrdered, AlertTriangle } from "lucide-react";
import ArrangeExportDialog from "./ArrangeExportDialog";

export default function BOQView({ estimate, onDrill }) {
  const project = useProjectStore((s) => s.project);
  const patchProject = useProjectStore((s) => s.patchProject);
  const currency = project?.currency || "USD";
  const [open, setOpen] = useState({});
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const categories = useMemo(() => Object.keys(estimate.byCategory), [estimate]);

  const exportMeta = {
    projectName: project.name,
    currency,
    subtotal: estimate.subtotal,
    overheadPct: estimate.overheadPct,
    overhead: estimate.overhead,
    grandTotal: estimate.grandTotal,
  };
  const exportOrder = project.estimateSettings?.exportOrder || [];
  const saveExportOrder = (order) =>
    patchProject({ estimateSettings: { ...project.estimateSettings, exportOrder: order } });

  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-6 py-6" data-testid="boq-table-container">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">Bill of Quantities</h2>
            <p className="text-sm text-slate-500">Auto-generated from the floor plan. Click a row to trace it back to the drawing.</p>
          </div>
          <Button variant="outline" onClick={() => setArrangeOpen(true)} data-testid="boq-arrange-export-button">
            <ListOrdered className="mr-1.5 h-4 w-4" /> Arrange &amp; Export
          </Button>
        </div>

        <ArrangeExportDialog
          open={arrangeOpen}
          onOpenChange={setArrangeOpen}
          estimate={estimate}
          meta={exportMeta}
          exportOrder={exportOrder}
          onSaveOrder={saveExportOrder}
        />

        {estimate.rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
            No quantities yet. Draw walls and rooms on the Floor Plan to generate the Bill of Quantities.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 w-10">#</th>
                  <th className="px-3 py-3">Construction Item</th>
                  <th className="px-3 py-3 text-right">Volume</th>
                  <th className="px-3 py-3">Unit</th>
                  <th className="px-3 py-3 text-right">Unit Price</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => {
                  const meta = CATEGORY_META[cat] || { label: cat, color: "#64748B" };
                  const group = estimate.byCategory[cat];
                  return (
                    <FragmentGroup key={cat}>
                      <tr className="bg-slate-50/70">
                        <td colSpan={7} className="px-3 py-2">
                          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: meta.color }} />
                            {meta.label}
                            <span className="font-mono text-slate-500">{formatMoney(group.total, currency)}</span>
                          </span>
                        </td>
                      </tr>
                      {group.rows.map((r) => (
                        <FragmentGroup key={r.id}>
                          <tr className="border-t border-slate-100 hover:bg-blue-50/40" data-testid={`boq-row-${r.id}`}>
                            <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{r.no}</td>
                            <td className="px-3 py-2.5">
                              <button className="flex items-center gap-1.5 text-left font-medium text-slate-800 hover:text-[#1E56A0]" onClick={() => toggle(r.id)}>
                                {open[r.id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                {r.name}
                                {r.unitCost <= 0 && (
                                  <span
                                    title="This item still needs a price"
                                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700"
                                  >
                                    <AlertTriangle className="h-3 w-3" /> Needs pricing
                                  </span>
                                )}
                              </button>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono">{fmtNum(r.volume)}</td>
                            <td className="px-3 py-2.5 text-slate-500">{r.unit}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-600">{formatMoney(r.unitCost, currency)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900">{formatMoney(r.total, currency)}</td>
                            <td className="px-3 py-2.5">
                              <button
                                title="Show source in drawing"
                                className="rounded p-1 text-slate-400 hover:bg-[#1E56A0] hover:text-white"
                                data-testid={`boq-drill-${r.id}`}
                                onClick={() => onDrill(r)}
                              >
                                <Crosshair className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                          {open[r.id] && (
                            <tr className="bg-slate-50/60">
                              <td></td>
                              <td colSpan={6} className="px-3 py-3">
                                <div className="rounded-lg border border-slate-200 bg-white p-3">
                                  {r.isCustom ? (
                                    <>
                                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Manually Entered Item
                                      </div>
                                      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                                        <FieldInfo label="Unit" value={r.unit} />
                                        <FieldInfo label="Quantity" value={fmtNum(r.volume)} />
                                        <FieldInfo label="Unit Price" value={formatMoney(r.unitCost, currency)} />
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Selected Material · {Math.round(r.wasteFactor * 100)}% waste
                                      </div>
                                      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                                        <FieldInfo label="Material" value={r.material.materialName} />
                                        <FieldInfo label="Confidence" value={r.material.confidence} />
                                        <FieldInfo label="Source" value={r.material.sourceName} />
                                        <FieldInfo label="Checked" value={r.material.sourceDate} />
                                      </div>
                                      <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-2 text-xs text-slate-500">
                                        <span>Source elements: <b className="text-slate-700">{r.sources.length}</b></span>
                                        <span>Needed (incl. waste): <b className="font-mono text-slate-700">{fmtNum(r.purchase.effectiveQty)} {r.unit}</b></span>
                                        <span>Packages: <b className="font-mono text-slate-700">{r.purchase.packagesNeeded} × {formatMoney(r.material.sourcePrice, r.material.currency)}</b></span>
                                        <span>Theoretical: <b className="font-mono text-slate-700">{formatMoney(r.purchase.theoreticalCost, currency)}</b></span>
                                        <span>Purchase cost: <b className="font-mono text-slate-700">{formatMoney(r.purchase.purchaseCost, currency)}</b></span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </FragmentGroup>
                      ))}
                    </FragmentGroup>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-mono">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-right text-slate-500">Subtotal</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatMoney(estimate.subtotal, currency)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-right text-slate-500">Overhead &amp; Profit ({estimate.overheadPct}%)</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatMoney(estimate.overhead, currency)}</td>
                  <td></td>
                </tr>
                <tr className="bg-[#EFF6FF] text-[#1E56A0]">
                  <td colSpan={5} className="px-3 py-3 text-right font-display text-sm font-bold">GRAND TOTAL</td>
                  <td data-testid="boq-total-cost-display" className="px-3 py-3 text-right font-display text-base font-bold">{formatMoney(estimate.grandTotal, currency)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FragmentGroup({ children }) {
  return <>{children}</>;
}

function FieldInfo({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="truncate text-slate-700">{value}</div>
    </div>
  );
}
