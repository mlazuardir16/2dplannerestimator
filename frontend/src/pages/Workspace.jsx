import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useProjectStore } from "@/store/useProjectStore";
import { getProject, updateProject } from "@/lib/api";
import { computeEstimate } from "@/lib/estimateEngine";
import PlannerTopBar from "@/components/planner/PlannerTopBar";
import ToolPalette from "@/components/planner/ToolPalette";
import CanvasWorkspace from "@/components/planner/CanvasWorkspace";
import Inspector from "@/components/planner/Inspector";
import FloorSwitcher from "@/components/planner/FloorSwitcher";
import StatusBar from "@/components/planner/StatusBar";
import BOQView from "@/components/boq/BOQView";
import CostSummary from "@/components/boq/CostSummary";
import MaterialsView from "@/components/boq/MaterialsView";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Workspace() {
  const { id } = useParams();
  const project = useProjectStore((s) => s.project);
  const dirty = useProjectStore((s) => s.dirty);
  const setProject = useProjectStore((s) => s.setProject);
  const markSaved = useProjectStore((s) => s.markSaved);
  const setTool = useProjectStore((s) => s.setTool);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const setHighlight = useProjectStore((s) => s.setHighlight);
  const clearHighlight = useProjectStore((s) => s.clearHighlight);
  const setActiveFloor = useProjectStore((s) => s.setActiveFloor);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("plan");
  const saveTimer = useRef(null);

  useEffect(() => {
    let mounted = true;
    getProject(id)
      .then((p) => {
        if (mounted) setProject(p);
      })
      .catch(() => toast.error("Could not load project"))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [id, setProject]);

  const estimate = useMemo(() => (project ? computeEstimate(project) : null), [project]);

  const doSave = useCallback(async () => {
    const state = useProjectStore.getState();
    const p = state.project;
    if (!p) return;
    setSaving(true);
    try {
      const r = computeEstimate(p);
      const payload = { ...p, estimatedCost: r.grandTotal, buildingArea: r.buildingArea };
      await updateProject(p.id, payload);
      markSaved();
    } catch (e) {
      console.error(e);
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }, [markSaved]);

  // autosave (debounced) when dirty
  useEffect(() => {
    if (!dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(), 1500);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [dirty, project, doSave]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        doSave();
        return;
      }
      if (tab !== "plan") return;
      const map = {
        v: "select", w: "wall", d: "door", n: "window", c: "column", u: "utility", h: "pan",
        k: "customPoint", l: "customLine", r: "railing",
        // stairs only make sense once there's more than one floor to connect
        ...((project?.floorCount || 1) > 1 ? { s: "stair" } : {}),
      };
      if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, setTool, doSave, tab, project]);

  const onDrill = (row) => {
    const ids = (row.sources || []).map((s) => s.id);
    // jump to the floor of the first source
    if (row.sources?.length) setActiveFloor(row.sources[0].floor);
    setHighlight(ids);
    setTab("plan");
    toast.info(`Highlighting ${ids.length} source element(s) for "${row.name}"`);
    setTimeout(() => clearHighlight(), 4000);
  };

  if (loading || !project) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading project…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <PlannerTopBar
        project={project}
        activeTab={tab}
        setActiveTab={setTab}
        onSave={doSave}
        saving={saving}
        dirty={dirty}
        grandTotal={estimate?.grandTotal || 0}
      />

      {tab === "plan" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <FloorSwitcher />
          <div className="flex min-h-0 flex-1">
            <ToolPalette />
            <div className="relative min-w-0 flex-1">
              <CanvasWorkspace />
            </div>
            <Inspector />
          </div>
          <StatusBar estimate={estimate} />
        </div>
      )}

      {tab === "boq" && <BOQView estimate={estimate} onDrill={onDrill} />}
      {tab === "cost" && <CostSummary estimate={estimate} />}
      {tab === "materials" && <MaterialsView />}
    </div>
  );
}
