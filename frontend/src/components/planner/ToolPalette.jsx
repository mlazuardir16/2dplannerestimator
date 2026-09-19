import { useProjectStore } from "@/store/useProjectStore";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  MousePointer2,
  Minus,
  DoorOpen,
  Square,
  Columns3,
  Zap,
  Hand,
  Undo2,
  Redo2,
} from "lucide-react";

const TOOLS = [
  { id: "select", icon: MousePointer2, label: "Select / Move (V)", testid: "canvas-select-tool" },
  { id: "wall", icon: Minus, label: "Draw Wall (W)", testid: "canvas-draw-wall-tool" },
  { id: "door", icon: DoorOpen, label: "Add Door — click a wall (D)", testid: "canvas-door-tool" },
  { id: "window", icon: Square, label: "Add Window — click a wall (N)", testid: "canvas-window-tool" },
  { id: "column", icon: Columns3, label: "Add Column (C)", testid: "canvas-column-tool" },
  { id: "utility", icon: Zap, label: "Add Utility Point (U)", testid: "canvas-utility-tool" },
  { id: "pan", icon: Hand, label: "Pan (Space)", testid: "canvas-pan-tool" },
];

export default function ToolPalette() {
  const tool = useProjectStore((s) => s.tool);
  const setTool = useProjectStore((s) => s.setTool);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const history = useProjectStore((s) => s.history);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 border-r border-slate-200 bg-white py-3">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = tool === t.id;
          return (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <button
                  data-testid={t.testid}
                  onClick={() => setTool(t.id)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all ${
                    active
                      ? "bg-[#1E56A0] text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{t.label}</TooltipContent>
            </Tooltip>
          );
        })}
        <div className="my-1 h-px w-8 bg-slate-200" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              data-testid="canvas-undo-button"
              onClick={undo}
              disabled={!history.past.length}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
            >
              <Undo2 className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              data-testid="canvas-redo-button"
              onClick={redo}
              disabled={!history.future.length}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
            >
              <Redo2 className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
