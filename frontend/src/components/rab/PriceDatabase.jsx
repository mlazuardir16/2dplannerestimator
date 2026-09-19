import { useState } from "react";
import { useProjectStore } from "@/store/useProjectStore";
import { formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const TYPE_LABEL = { material: "Material", labor: "Labor", equipment: "Equipment" };
const TYPE_COLOR = { material: "#1E56A0", labor: "#0D9488", equipment: "#D97706" };

export default function PriceDatabase() {
  const project = useProjectStore((s) => s.project);
  const updateResource = useProjectStore((s) => s.updateResource);
  const patchProject = useProjectStore((s) => s.patchProject);
  const currency = project?.currency || "USD";
  const [q, setQ] = useState("");

  const resources = (project?.resourcesDb || []).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()));

  const grouped = {
    material: resources.filter((r) => r.type === "material"),
    labor: resources.filter((r) => r.type === "labor"),
    equipment: resources.filter((r) => r.type === "equipment"),
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-6 py-6" data-testid="price-database-view">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">Price Database</h2>
            <p className="text-sm text-slate-500">Edit unit rates — the entire RAB recalculates instantly.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
              <span className="text-slate-500">Overhead %</span>
              <input
                data-testid="overhead-input"
                type="number"
                className="w-16 bg-transparent font-mono font-semibold text-slate-900 outline-none"
                value={project.overheadPct}
                onChange={(e) => patchProject({ overheadPct: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input data-testid="price-db-search-input" className="pl-9" placeholder="Search resource…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
        </div>

        {Object.entries(grouped).map(([type, rows]) =>
          rows.length ? (
            <div key={type} className="mb-6">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: TYPE_COLOR[type] }}>
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLOR[type] }} /> {TYPE_LABEL[type]}
              </h3>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2.5">Resource</th>
                      <th className="px-4 py-2.5">Unit</th>
                      <th className="px-4 py-2.5 text-right">Unit Price ({currency})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                        <td className="px-4 py-2.5 text-slate-500">{r.unit}</td>
                        <td className="px-4 py-2 text-right">
                          <input
                            data-testid={`price-input-${r.id}`}
                            type="number"
                            step="0.01"
                            value={r.price}
                            onChange={(e) => updateResource(r.id, e.target.value)}
                            className="w-28 rounded-md border border-slate-200 px-2 py-1 text-right font-mono text-sm focus:border-[#1E56A0] focus:outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
