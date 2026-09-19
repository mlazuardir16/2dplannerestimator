import { useProjectStore } from "@/store/useProjectStore";
import { Button } from "@/components/ui/button";
import { Layers, Plus, Copy, Eye } from "lucide-react";

export default function FloorSwitcher() {
  const project = useProjectStore((s) => s.project);
  const activeFloor = useProjectStore((s) => s.activeFloor);
  const setActiveFloor = useProjectStore((s) => s.setActiveFloor);
  const addFloor = useProjectStore((s) => s.addFloor);
  const duplicateFloor = useProjectStore((s) => s.duplicateFloor);
  const ghost = useProjectStore((s) => s.ghost);
  const toggleGhost = useProjectStore((s) => s.toggleGhost);

  const floors = project?.floors || [];

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
      <Layers className="h-4 w-4 text-slate-400" />
      <div className="flex items-center gap-1.5">
        {floors.map((f, i) => (
          <button
            key={f.id}
            data-testid={i === 0 ? "floor-switcher-ground" : `floor-switcher-${i}`}
            onClick={() => setActiveFloor(i)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              i === activeFloor ? "bg-[#1E56A0] text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-500" onClick={addFloor} data-testid="floor-add-button">
        <Plus className="h-3.5 w-3.5" /> Floor
      </Button>
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-500" onClick={duplicateFloor} data-testid="floor-duplicate-button">
        <Copy className="h-3.5 w-3.5" /> Duplicate
      </Button>
      <div className="ml-auto">
        <button
          data-testid="floor-switcher-ghost-toggle"
          onClick={toggleGhost}
          disabled={activeFloor === 0}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40 ${
            ghost ? "bg-blue-50 text-[#1E56A0]" : "bg-slate-100 text-slate-500"
          }`}
        >
          <Eye className="h-3.5 w-3.5" /> Ghost layer below
        </button>
      </div>
    </div>
  );
}
