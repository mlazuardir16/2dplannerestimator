import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useProjectStore } from "@/store/useProjectStore";
import { getProject, updateProject } from "@/lib/api";
import { useRab } from "@/hooks/useRab";
import PlannerTopBar from "@/components/planner/PlannerTopBar";
import ToolPalette from "@/components/planner/ToolPalette";
import CanvasWorkspace from "@/components/planner/CanvasWorkspace";
import Inspector from "@/components/planner/Inspector";
import FloorSwitcher from "@/components/planner/FloorSwitcher";
import StatusBar from "@/components/planner/StatusBar";
import { RabGate } from "@/components/rab/common";
import RekapView from "@/components/rab/RekapView";
import RabTableView from "@/components/rab/RabTableView";
import BahanView from "@/components/rab/BahanView";
import UpahView from "@/components/rab/UpahView";
import JadwalView from "@/components/rab/JadwalView";
import InputView from "@/components/rab/InputView";
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

  const rab = useRab(project);
  // doSave reads the latest RAB result without re-creating the callback.
  const rabResult = useRef(null);
  rabResult.current = rab.result;

  useEffect(() => {
    if (rab.error) toast.error(rab.error);
  }, [rab.error]);

  const doSave = useCallback(async () => {
    const state = useProjectStore.getState();
    const p = state.project;
    if (!p) return;
    setSaving(true);
    try {
      // Dashboard snapshot: the contractor (borongan) total, in rupiah.
      const r = rabResult.current;
      const payload = {
        ...p,
        currency: "IDR",
        estimatedCost: r ? r.borongan.total : p.estimatedCost,
        buildingArea: r ? r.building_area : p.buildingArea,
      };
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
        boronganTotal={rab.result?.borongan.total ?? null}
        calculating={rab.loading}
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
          <StatusBar />
        </div>
      )}

      {tab !== "plan" && (
        <div className="min-h-0 flex-1">
          <RabGate rab={rab}>
            {tab === "rekap" && <RekapView rab={rab} />}
            {tab === "rab" && <RabTableView rab={rab} />}
            {tab === "bahan" && <BahanView rab={rab} />}
            {tab === "upah" && <UpahView rab={rab} />}
            {tab === "jadwal" && <JadwalView rab={rab} />}
            {tab === "input" && <InputView rab={rab} />}
          </RabGate>
        </div>
      )}
    </div>
  );
}
