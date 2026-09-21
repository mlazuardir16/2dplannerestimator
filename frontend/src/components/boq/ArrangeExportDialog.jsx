import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { CATEGORY_META } from "@/lib/constructionItems";
import { applyExportOrder, exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportEstimate";
import { ChevronUp, ChevronDown, FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { toast } from "sonner";

export default function ArrangeExportDialog({ open, onOpenChange, estimate, meta, exportOrder, onSaveOrder }) {
  const [order, setOrder] = useState([]);

  useEffect(() => {
    if (open) setOrder(applyExportOrder(estimate.rows, exportOrder).map((r) => r.id));
  }, [open, estimate.rows, exportOrder]);

  const byId = new Map(estimate.rows.map((r) => [r.id, r]));
  const orderedRows = order.map((id) => byId.get(id)).filter(Boolean);

  const move = (idx, dir) => {
    const next = [...order];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setOrder(next);
  };

  const doExport = (fn, label) => {
    onSaveOrder(order);
    fn(orderedRows, meta);
    toast.success(`Exported to ${label}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="arrange-export-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Arrange &amp; Export</DialogTitle>
          <DialogDescription>Reorder rows before exporting — the order here is used in every export format.</DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {orderedRows.map((r, idx) => {
            const meta2 = CATEGORY_META[r.category] || { label: r.category, color: "#64748B" };
            return (
              <div key={r.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" data-testid={`arrange-row-${r.id}`}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta2.color }} />
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="shrink-0 font-mono text-xs text-slate-500">{formatMoney(r.total, meta.currency)}</span>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                    disabled={idx === 0}
                    onClick={() => move(idx, -1)}
                    data-testid={`arrange-up-${r.id}`}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                    disabled={idx === orderedRows.length - 1}
                    onClick={() => move(idx, 1)}
                    data-testid={`arrange-down-${r.id}`}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => doExport(exportToCSV, "CSV")} data-testid="arrange-export-csv-button">
            <FileDown className="mr-1.5 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" onClick={() => doExport(exportToExcel, "Excel")} data-testid="arrange-export-excel-button">
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
          </Button>
          <Button onClick={() => doExport(exportToPDF, "PDF")} className="bg-[#1E56A0] hover:bg-[#163E75]" data-testid="arrange-export-pdf-button">
            <FileText className="mr-1.5 h-4 w-4" /> PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
