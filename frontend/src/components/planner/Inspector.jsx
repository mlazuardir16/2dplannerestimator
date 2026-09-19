import { useProjectStore } from "@/store/useProjectStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UTILITY_KINDS } from "@/lib/constructionItems";
import { dist, roomKey } from "@/lib/geometry";
import { Trash2, Info } from "lucide-react";
import { fmtNum } from "@/lib/format";

function Row({ label, children }) {
  return (
    <div className="grid gap-1">
      <Label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

export default function Inspector() {
  const project = useProjectStore((s) => s.project);
  const activeFloor = useProjectStore((s) => s.activeFloor);
  const selected = useProjectStore((s) => s.selected);
  const utilityKind = useProjectStore((s) => s.utilityKind);
  const wallType = useProjectStore((s) => s.wallType);
  const tool = useProjectStore((s) => s.tool);
  const setUtilityKind = useProjectStore((s) => s.setUtilityKind);
  const setWallType = useProjectStore((s) => s.setWallType);
  const updateWall = useProjectStore((s) => s.updateWall);
  const updateColumn = useProjectStore((s) => s.updateColumn);
  const updateOpening = useProjectStore((s) => s.updateOpening);
  const setRoomName = useProjectStore((s) => s.setRoomName);
  const deleteElement = useProjectStore((s) => s.deleteElement);

  const floor = project?.floors?.[activeFloor];

  const wall = selected?.type === "wall" ? floor.walls.find((w) => w.id === selected.id) : null;
  const column = selected?.type === "column" ? floor.columns.find((c) => c.id === selected.id) : null;
  const util = selected?.type === "utility" ? floor.utilities.find((u) => u.id === selected.id) : null;
  const door = selected?.type === "door" ? floor.doors.find((d) => d.id === selected.id) : null;
  const win = selected?.type === "window" ? floor.windows.find((w) => w.id === selected.id) : null;

  return (
    <div className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-[#FAFBFC]" data-testid="inspector-panel">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-display text-sm font-semibold text-slate-900">Properties</h3>
        <p className="text-xs text-slate-500">{selected ? `Selected ${selected.type}` : "Nothing selected"}</p>
      </div>

      <div className="flex-1 space-y-5 p-4">
        {/* Tool defaults when nothing selected */}
        {!selected && (
          <>
            {tool === "wall" && (
              <Row label="New Wall Type">
                <Select value={wallType} onValueChange={setWallType}>
                  <SelectTrigger data-testid="inspector-walltype-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exterior">Exterior (0.20m)</SelectItem>
                    <SelectItem value="interior">Interior partition (0.15m)</SelectItem>
                    <SelectItem value="fence">Fence (0.10m)</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
            )}
            {tool === "utility" && (
              <Row label="Utility Type">
                <Select value={utilityKind} onValueChange={setUtilityKind}>
                  <SelectTrigger data-testid="inspector-utility-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UTILITY_KINDS.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.label} · {u.category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
            )}
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1E56A0]" />
              <span>Pick a tool and click on the canvas. Select an element to edit its dimensions and material here.</span>
            </div>
          </>
        )}

        {wall && (
          <>
            <Row label="Length">
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-700">
                {fmtNum(dist(wall.start, wall.end))} m
              </div>
            </Row>
            <Row label="Thickness (m)">
              <Input data-testid="inspector-wall-thickness-input" type="number" step="0.01" value={wall.thickness}
                onChange={(e) => updateWall(wall.id, { thickness: Number(e.target.value) || 0 })} />
            </Row>
            <Row label="Height (m)">
              <Input type="number" step="0.1" value={wall.height}
                onChange={(e) => updateWall(wall.id, { height: Number(e.target.value) || 0 })} />
            </Row>
            <Row label="Wall Type">
              <Select value={wall.wallType} onValueChange={(v) => updateWall(wall.id, { wallType: v })}>
                <SelectTrigger data-testid="inspector-wall-material-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exterior">Exterior</SelectItem>
                  <SelectItem value="interior">Interior partition</SelectItem>
                  <SelectItem value="fence">Fence</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <DeleteBtn onClick={() => deleteElement("wall", wall.id)} />
          </>
        )}

        {(door || win) && (
          <OpeningEditor
            o={door || win}
            kind={door ? "door" : "window"}
            updateOpening={updateOpening}
            deleteElement={deleteElement}
          />
        )}

        {column && (
          <>
            <Row label="Width (m)">
              <Input type="number" step="0.05" value={column.width} onChange={(e) => updateColumn(column.id, { width: Number(e.target.value) || 0 })} />
            </Row>
            <Row label="Depth (m)">
              <Input type="number" step="0.05" value={column.depth} onChange={(e) => updateColumn(column.id, { depth: Number(e.target.value) || 0 })} />
            </Row>
            <Row label="Height (m)">
              <Input type="number" step="0.1" value={column.height} onChange={(e) => updateColumn(column.id, { height: Number(e.target.value) || 0 })} />
            </Row>
            <DeleteBtn onClick={() => deleteElement("column", column.id)} />
          </>
        )}

        {util && (
          <>
            <Row label="Utility Type">
              <Select value={util.kind} onValueChange={(v) => useProjectStore.getState().updateUtilityRaw(util.id, { kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UTILITY_KINDS.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <DeleteBtn onClick={() => deleteElement("utility", util.id)} />
          </>
        )}

        {selected?.type === "room" && (
          <>
            <Row label="Room Name">
              <Input
                data-testid="inspector-room-name-input"
                placeholder="e.g. Living Room"
                defaultValue={floor.roomNames?.[selected.id]?.name || ""}
                onBlur={(e) => setRoomName(selected.id, e.target.value)}
              />
            </Row>
            <Row label="Area">
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-700">
                {fmtNum(selected.area)} m²
              </div>
            </Row>
            <Row label="Perimeter">
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-700">
                {fmtNum(selected.perimeter)} m
              </div>
            </Row>
            <div className="grid grid-cols-2 gap-2">
              {["Living Room", "Bedroom", "Master Bedroom", "Kitchen", "Bathroom", "Garage"].map((n) => (
                <button key={n} onClick={() => setRoomName(selected.id, n)} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:border-[#1E56A0] hover:text-[#1E56A0]">
                  {n}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OpeningEditor({ o, kind, updateOpening, deleteElement }) {
  return (
    <>
      <Row label="Width (m)">
        <Input data-testid="inspector-opening-width-input" type="number" step="0.05" value={o.width} onChange={(e) => updateOpening(kind, o.id, { width: Number(e.target.value) || 0 })} />
      </Row>
      <Row label="Height (m)">
        <Input type="number" step="0.05" value={o.height} onChange={(e) => updateOpening(kind, o.id, { height: Number(e.target.value) || 0 })} />
      </Row>
      {kind === "window" && (
        <Row label="Sill Height (m)">
          <Input type="number" step="0.05" value={o.sill} onChange={(e) => updateOpening(kind, o.id, { sill: Number(e.target.value) || 0 })} />
        </Row>
      )}
      <Row label="Position along wall">
        <Input type="range" min="0" max="1" step="0.01" value={o.t} onChange={(e) => updateOpening(kind, o.id, { t: Number(e.target.value) })} />
      </Row>
      <DeleteBtn onClick={() => deleteElement(kind, o.id)} />
    </>
  );
}

function DeleteBtn({ onClick }) {
  return (
    <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={onClick} data-testid="inspector-delete-button">
      <Trash2 className="mr-1.5 h-4 w-4" /> Delete
    </Button>
  );
}
