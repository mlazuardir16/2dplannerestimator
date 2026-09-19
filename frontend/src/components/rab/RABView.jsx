import { useMemo, useState } from "react";
import { useProjectStore } from "@/store/useProjectStore";
import { CATEGORY_META } from "@/lib/constructionItems";
import { formatMoney, fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Crosshair, FileDown } from "lucide-react";
import { toast } from "sonner";

export default function RABView({ rab, onDrill }) {
  const project = useProjectStore((s) => s.project);
  const currency = project?.currency || "USD";
  const [open, setOpen] = useState({});
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const categories = useMemo(() => Object.keys(rab.byCategory), [rab]);

  const exportCSV = () => {
    const lines = [["No", "Item", "Category", "Volume", "Unit", "Unit Price", "Material", "Labor", "Total"].join(",")];
    rab.rows.forEach((r) => {
      lines.push([
        r.no, `"${r.name}"`, r.category, r.volume.toFixed(2), r.unit,
        r.unitCost.toFixed(2), r.materialCost.toFixed(2), r.laborCost.toFixed(2), r.total.toFixed(2),
      ].join(","));
    });
    lines.push(["", "", "", "", "", "", "", "Subtotal", rab.subtotal.toFixed(2)].join(","));
    lines.push(["", "", "", "", "", "", "", `Overhead ${rab.overheadPct}%`, rab.overhead.toFixed(2)].join(","));
    lines.push(["", "", "", "", "", "", "", "Grand Total", rab.grandTotal.toFixed(2)].join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "_")}_RAB.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("RAB exported to CSV");
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-6 py-6" data-testid="rab-table-container">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">Bill of Quantities (RAB)</h2>
            <p className="text-sm text-slate-500">Auto-generated from the floor plan. Click a row to trace it back to the drawing.</p>
          </div>
          <Button variant="outline" onClick={exportCSV} data-testid="rab-export-csv-button">
            <FileDown className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
        </div>

        {rab.rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
            No quantities yet. Draw walls and rooms on the Floor Plan to generate the RAB.
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
                  const group = rab.byCategory[cat];
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
                          <tr className="border-t border-slate-100 hover:bg-blue-50/40" data-testid={`rab-row-${r.id}`}>
                            <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{r.no}</td>
                            <td className="px-3 py-2.5">
                              <button className="flex items-center gap-1.5 text-left font-medium text-slate-800 hover:text-[#1E56A0]" onClick={() => toggle(r.id)}>
                                {open[r.id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                {r.name}
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
                                data-testid={`rab-drill-${r.id}`}
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
                                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    AHSP Breakdown · per {r.unit} (incl. {Math.round(r.wasteFactor * 100)}% waste)
                                  </div>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-left text-slate-400">
                                        <th className="py-1">Resource</th>
                                        <th className="py-1">Type</th>
                                        <th className="py-1 text-right">Coefficient</th>
                                        <th className="py-1 text-right">Unit Price</th>
                                        <th className="py-1 text-right">Cost</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {r.breakdown.map((b) => (
                                        <tr key={b.ref} className="border-t border-slate-100">
                                          <td className="py-1 text-slate-700">{b.name}</td>
                                          <td className="py-1 capitalize text-slate-500">{b.type}</td>
                                          <td className="py-1 text-right font-mono">{fmtNum(b.coef, 3)} {b.unit}</td>
                                          <td className="py-1 text-right font-mono text-slate-500">{formatMoney(b.price, currency)}</td>
                                          <td className="py-1 text-right font-mono">{formatMoney(b.cost, currency)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  <div className="mt-2 flex gap-4 border-t border-slate-100 pt-2 text-xs text-slate-500">
                                    <span>Source elements: <b className="text-slate-700">{r.sources.length}</b></span>
                                    <span>Material: <b className="font-mono text-slate-700">{formatMoney(r.materialCost, currency)}</b></span>
                                    <span>Labor: <b className="font-mono text-slate-700">{formatMoney(r.laborCost, currency)}</b></span>
                                  </div>
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
                  <td className="px-3 py-2 text-right font-semibold">{formatMoney(rab.subtotal, currency)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-right text-slate-500">Overhead &amp; Profit ({rab.overheadPct}%)</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatMoney(rab.overhead, currency)}</td>
                  <td></td>
                </tr>
                <tr className="bg-[#EFF6FF] text-[#1E56A0]">
                  <td colSpan={5} className="px-3 py-3 text-right font-display text-sm font-bold">GRAND TOTAL</td>
                  <td data-testid="rab-total-cost-display" className="px-3 py-3 text-right font-display text-base font-bold">{formatMoney(rab.grandTotal, currency)}</td>
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
