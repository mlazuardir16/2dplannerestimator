import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listProjects, deleteProject } from "@/lib/api";
import { formatMoney, fmtDate, fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NewProjectModal from "@/components/dashboard/NewProjectModal";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Ruler,
  Layers,
  MoreVertical,
  Trash2,
  Building2,
  Home,
  DraftingCompass,
} from "lucide-react";
import { toast } from "sonner";

function ProjectThumb({ project }) {
  // lightweight generated blueprint preview
  return (
    <div className="relative h-36 w-full overflow-hidden rounded-t-xl bg-[#0f2744]">
      <svg viewBox="0 0 200 100" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`g-${project.id}`} width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="#1e3a5f" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="200" height="100" fill={`url(#g-${project.id})`} />
        <g stroke="#5b9bd5" strokeWidth="2.5" fill="none">
          <rect x="45" y="22" width="110" height="56" />
          <line x1="100" y1="22" x2="100" y2="55" />
          <line x1="45" y1="55" x2="100" y2="55" />
          <line x1="100" y1="48" x2="155" y2="48" />
        </g>
        <circle cx="72" cy="78" r="3" fill="#f59e0b" />
      </svg>
      <div className="absolute bottom-2 right-2 rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-mono text-sky-200 backdrop-blur">
        {project.building?.length || 0}×{project.building?.width || 0}m
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");

  const load = () => {
    setLoading(true);
    listProjects()
      .then((data) => setProjects(data || []))
      .catch(() => toast.error("Could not load projects"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteProject(id);
      setProjects((p) => p.filter((x) => x.id !== id));
      toast.success("Project deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  const filtered = projects.filter(
    (p) =>
      !query ||
      p.name?.toLowerCase().includes(query.toLowerCase()) ||
      p.client?.toLowerCase().includes(query.toLowerCase())
  );

  const totalValue = projects.reduce((s, p) => s + (p.estimatedCost || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E56A0] text-white">
              <DraftingCompass className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-bold leading-none tracking-tight text-slate-900">PlanCost</div>
              <div className="text-[11px] text-slate-500">Floor Planner &amp; RAB Estimator</div>
            </div>
          </div>
          <Button data-testid="dashboard-new-project-button" onClick={() => setModalOpen(true)} className="bg-[#1E56A0] hover:bg-[#163E75]">
            <Plus className="mr-1.5 h-4 w-4" /> New Plan
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* stat strip */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={<Building2 className="h-5 w-5" />} label="Projects" value={projects.length} />
          <StatCard icon={<Home className="h-5 w-5" />} label="Total Building Area" value={`${fmtNum(projects.reduce((s, p) => s + (p.buildingArea || 0), 0), 1)} m²`} />
          <StatCard icon={<Ruler className="h-5 w-5" />} label="Estimated Portfolio Value" value={formatMoney(totalValue, "USD")} accent />
        </div>

        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Your Projects</h1>
            <p className="text-sm text-slate-500">Draw a floor plan and get an instant construction cost estimate.</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              data-testid="dashboard-search-input"
              className="pl-9"
              placeholder="Search projects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => setModalOpen(true)} hasProjects={projects.length > 0} />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, idx) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                data-testid={`dashboard-project-card-${p.id}`}
                onClick={() => navigate(`/project/${p.id}`)}
                className="group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#1E56A0]/40 hover:shadow-md"
              >
                <ProjectThumb project={p} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base font-semibold text-slate-900">{p.name}</h3>
                      <p className="truncate text-xs text-slate-500">{p.client || "No client"} · {fmtDate(p.updatedAt)}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-red-600" onClick={(e) => remove(e, p.id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Layers className="h-3.5 w-3.5" /> {p.floorCount || 1} floor{(p.floorCount || 1) > 1 ? "s" : ""}
                    </span>
                    <span className="font-mono text-sm font-semibold text-[#1E56A0]">
                      {formatMoney(p.estimatedCost || 0, p.currency || "USD")}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <NewProjectModal open={modalOpen} onOpenChange={setModalOpen} onCreated={load} />
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className={`flex items-center gap-4 rounded-xl border p-5 ${accent ? "border-[#1E56A0]/20 bg-[#EFF6FF]" : "border-slate-200 bg-white"}`}>
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${accent ? "bg-[#1E56A0] text-white" : "bg-slate-100 text-slate-600"}`}>
        {icon}
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="font-display text-xl font-bold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate, hasProjects }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#1E56A0]">
        <DraftingCompass className="h-8 w-8" />
      </div>
      <h3 className="font-display text-lg font-semibold text-slate-900">{hasProjects ? "No matching projects" : "Start your first plan"}</h3>
      <p className="mb-5 mt-1 max-w-sm text-sm text-slate-500">
        Create a project, draw walls on the canvas, and watch the construction cost estimate build itself.
      </p>
      <Button onClick={onCreate} className="bg-[#1E56A0] hover:bg-[#163E75]">
        <Plus className="mr-1.5 h-4 w-4" /> New Plan
      </Button>
    </div>
  );
}
