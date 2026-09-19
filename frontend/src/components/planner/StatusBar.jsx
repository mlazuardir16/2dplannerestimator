import { useProjectStore } from "@/store/useProjectStore";
import { ZoomIn, ZoomOut, Maximize, Grid3x3, Magnet } from "lucide-react";

export default function StatusBar({ rab }) {
  const view = useProjectStore((s) => s.view);
  const setView = useProjectStore((s) => s.setView);
  const grid = useProjectStore((s) => s.grid);
  const toggleSnap = useProjectStore((s) => s.toggleSnap);
  const toggleGridShow = useProjectStore((s) => s.toggleGridShow);
  const project = useProjectStore((s) => s.project);
  const activeFloor = useProjectStore((s) => s.activeFloor);

  const floor = project?.floors?.[activeFloor];
  const zoomPct = Math.round((view.scale / 48) * 100);

  const zoom = (factor) => {
    const scale = Math.max(8, Math.min(400, view.scale * factor));
    setView({ ...view, scale });
  };
  const reset = () => setView({ scale: 48, panX: 200, panY: 140 });

  return (
    <div className="flex h-9 items-center justify-between border-t border-slate-200 bg-white px-4 font-mono text-[11px] text-slate-500">
      <div className="flex items-center gap-4">
        <span>Walls: {floor?.walls?.length || 0}</span>
        <span>Doors: {floor?.doors?.length || 0}</span>
        <span>Windows: {floor?.windows?.length || 0}</span>
        <span>Columns: {floor?.columns?.length || 0}</span>
        <span>Grid: {grid.major}m / {grid.minor}m</span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={toggleGridShow} className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${grid.show ? "text-[#1E56A0]" : "text-slate-400"}`}>
          <Grid3x3 className="h-3.5 w-3.5" /> Grid
        </button>
        <button data-testid="canvas-grid-snap-toggle" onClick={toggleSnap} className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${grid.snap ? "text-[#1E56A0]" : "text-slate-400"}`}>
          <Magnet className="h-3.5 w-3.5" /> Snap
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <button data-testid="canvas-zoom-out" onClick={() => zoom(1 / 1.2)} className="rounded p-1 hover:bg-slate-100"><ZoomOut className="h-3.5 w-3.5" /></button>
        <span data-testid="canvas-zoom-level" className="w-10 text-center">{zoomPct}%</span>
        <button data-testid="canvas-zoom-in" onClick={() => zoom(1.2)} className="rounded p-1 hover:bg-slate-100"><ZoomIn className="h-3.5 w-3.5" /></button>
        <button data-testid="canvas-zoom-reset" onClick={reset} className="rounded p-1 hover:bg-slate-100"><Maximize className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
