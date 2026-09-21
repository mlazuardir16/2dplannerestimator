import { useProjectStore } from "@/store/useProjectStore";
import { CATEGORY_META } from "@/lib/constructionItems";
import { formatMoney, fmtNum } from "@/lib/format";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";
import { Ruler, Home, Hammer, Package, DollarSign } from "lucide-react";

export default function CostSummary({ estimate }) {
  const project = useProjectStore((s) => s.project);
  const currency = project?.currency || "USD";

  const catData = Object.entries(estimate.byCategory).map(([k, v]) => ({
    name: CATEGORY_META[k]?.label || k,
    value: v.total,
    color: CATEGORY_META[k]?.color || "#64748B",
  }));

  const splitData = [
    { name: "Materials", value: estimate.materialTotal, color: "#1E56A0" },
    { name: "Labor", value: estimate.laborTotal, color: "#0D9488" },
    { name: "Equipment", value: estimate.equipmentTotal, color: "#D97706" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-6 py-6" data-testid="cost-summary-view">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-1 font-display text-2xl font-bold tracking-tight text-slate-900">Cost Summary</h2>
        <p className="mb-6 text-sm text-slate-500">Executive overview of your estimated construction budget.</p>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Metric icon={<DollarSign className="h-5 w-5" />} label="Grand Total" value={formatMoney(estimate.grandTotal, currency)} accent />
          <Metric icon={<Ruler className="h-5 w-5" />} label="Cost per m²" value={formatMoney(estimate.costPerM2, currency)} />
          <Metric icon={<Home className="h-5 w-5" />} label="Building Area" value={`${fmtNum(estimate.buildingArea, 1)} m²`} />
          <Metric icon={<Package className="h-5 w-5" />} label="Floor Area (all)" value={`${fmtNum(estimate.floorAreaTotal, 1)} m²`} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Cost by Category">
            {catData.length === 0 ? <Empty /> : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={220}>
                  <PieChart>
                    <Pie data={catData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2} data-testid="cost-summary-chart-category">
                      {catData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <RTooltip formatter={(v) => formatMoney(v, currency)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {catData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />{d.name}</span>
                      <span className="font-mono font-semibold text-slate-900">{formatMoney(d.value, currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title="Material vs Labor vs Equipment">
            {estimate.rows.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={splitData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <RTooltip formatter={(v) => formatMoney(v, currency)} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {splitData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        <Card title="Category Breakdown" className="mt-5">
          <div className="space-y-3">
            {catData.map((d) => {
              const pct = estimate.subtotal > 0 ? (d.value / estimate.subtotal) * 100 : 0;
              return (
                <div key={d.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-600">{d.name}</span>
                    <span className="font-mono text-slate-900">{formatMoney(d.value, currency)} · {fmtNum(pct, 0)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: d.color }} />
                  </div>
                </div>
              );
            })}
            {catData.length === 0 && <Empty />}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, accent }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${accent ? "border-[#1E56A0]/20 bg-[#EFF6FF]" : "border-slate-200 bg-white"}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent ? "bg-[#1E56A0] text-white" : "bg-slate-100 text-slate-500"}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
        <div className="truncate font-display text-lg font-bold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function Card({ title, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="mb-4 font-display text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="py-8 text-center text-sm text-slate-400">Draw a plan to see cost data.</div>;
}
