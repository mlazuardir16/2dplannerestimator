import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { newProject, starterHouse } from "@/lib/project";
import { computeRAB } from "@/lib/rabEngine";
import { createProject } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Sparkles, SquarePen } from "lucide-react";

export default function NewProjectModal({ open, onOpenChange, onCreated }) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    client: "",
    location: "",
    landLength: "",
    landWidth: "",
    buildingLength: "",
    buildingWidth: "",
    floorCount: "1",
    currency: "USD",
  });

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (withSample) => {
    if (!withSample && !form.name.trim()) {
      toast.error("Please enter a project name");
      return;
    }
    setSaving(true);
    try {
      let project;
      if (withSample) {
        project = starterHouse();
        if (form.name.trim()) project.name = form.name.trim();
      } else {
        project = newProject({
          name: form.name.trim(),
          client: form.client,
          location: form.location,
          land: { length: Number(form.landLength) || 0, width: Number(form.landWidth) || 0 },
          building: { length: Number(form.buildingLength) || 0, width: Number(form.buildingWidth) || 0 },
          floorCount: Number(form.floorCount) || 1,
          currency: form.currency,
        });
      }
      const rab = computeRAB(project);
      project.estimatedCost = rab.grandTotal;
      project.buildingArea = rab.buildingArea;
      const created = await createProject(project);
      toast.success("Project created");
      onOpenChange(false);
      onCreated?.(created);
      navigate(`/project/${created.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to create project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="new-project-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Create New Plan</DialogTitle>
          <DialogDescription>Set up your project details, or start instantly from a sample house.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Project Name</Label>
            <Input
              data-testid="new-project-name-input"
              placeholder="e.g. Riverside Family Home"
              value={form.name}
              onChange={(e) => upd("name", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Client</Label>
              <Input value={form.client} onChange={(e) => upd("client", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => upd("location", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Building Length (m)</Label>
              <Input type="number" value={form.buildingLength} onChange={(e) => upd("buildingLength", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Building Width (m)</Label>
              <Input type="number" value={form.buildingWidth} onChange={(e) => upd("buildingWidth", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Number of Floors</Label>
              <Select value={form.floorCount} onValueChange={(v) => upd("floorCount", v)}>
                <SelectTrigger data-testid="new-project-floors-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => upd("currency", v)}>
                <SelectTrigger data-testid="new-project-currency-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "IDR", "INR"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => submit(true)}
            disabled={saving}
            data-testid="new-project-sample-button"
          >
            <Sparkles className="h-4 w-4 mr-1.5" /> Start from sample house
          </Button>
          <Button onClick={() => submit(false)} disabled={saving} data-testid="new-project-create-button">
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <SquarePen className="h-4 w-4 mr-1.5" />}
            Create Blank Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
