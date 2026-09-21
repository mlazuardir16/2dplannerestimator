import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { ChevronLeft, Save, Loader2, Check, PencilRuler, Table2, PieChart, Tags } from "lucide-react";

const TABS = [
  { id: "plan", label: "Floor Plan", icon: PencilRuler, testid: "tab-plan-button" },
  { id: "boq", label: "BOQ", icon: Table2, testid: "boq-tab-button" },
  { id: "cost", label: "Cost Summary", icon: PieChart, testid: "tab-cost-button" },
  { id: "materials", label: "Materials", icon: Tags, testid: "tab-materials-button" },
];

export default function PlannerTopBar({ project, activeTab, setActiveTab, onSave, saving, dirty, grandTotal }) {
  const navigate = useNavigate();
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/")} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" data-testid="back-to-dashboard-button">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-semibold text-slate-900">{project?.name}</div>
          <div className="text-[11px] text-slate-500">{project?.client || "No client"} · {project?.location || "—"}</div>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              data-testid={t.testid}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                active ? "bg-white text-[#1E56A0] shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Est. Total</div>
          <div data-testid="topbar-total-cost" className="font-mono text-sm font-bold text-[#1E56A0]">
            {formatMoney(grandTotal, project?.currency || "USD")}
          </div>
        </div>
        <Button onClick={onSave} disabled={saving} variant={dirty ? "default" : "outline"} className={dirty ? "bg-[#1E56A0] hover:bg-[#163E75]" : ""} data-testid="save-project-button">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : dirty ? <Save className="mr-1.5 h-4 w-4" /> : <Check className="mr-1.5 h-4 w-4" />}
          {saving ? "Saving" : dirty ? "Save" : "Saved"}
        </Button>
      </div>
    </header>
  );
}
