import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { newProject, HOUSE_TEMPLATES } from "@/lib/project";
import { COUNTRIES, detectSupportedCountry, currencyForCountry } from "@/lib/countries";
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
    country: detectSupportedCountry(),
  });

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (templateId) => {
    if (!templateId && !form.name.trim()) {
      toast.error("Please enter a project name");
      return;
    }
    setSaving(true);
    try {
      let project;
      const template = templateId ? HOUSE_TEMPLATES.find((t) => t.id === templateId) : null;
      if (template) {
        project = template.build();
        if (form.name.trim()) project.name = form.name.trim();
        project.country = form.country;
        project.currency = currencyForCountry(form.country);
      } else {
        project = newProject({
          name: form.name.trim(),
          client: form.client,
          location: form.location,
          land: { length: Number(form.landLength) || 0, width: Number(form.landWidth) || 0 },
          building: { length: Number(form.buildingLength) || 0, width: Number(form.buildingWidth) || 0 },
          floorCount: Number(form.floorCount) || 1,
          country: form.country,
        });
      }
      // No material selections exist yet on a brand-new project, so there's
      // nothing to estimate until the user picks materials in the Materials
      // tab. Seed a best-effort buildingArea from the given dimensions only.
      project.estimatedCost = 0;
      project.buildingArea = (project.building?.length || 0) * (project.building?.width || 0);
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
          <DialogDescription>Set up your project details, or start instantly from a standard house template.</DialogDescription>
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
              <Label>Country</Label>
              <Select value={form.country} onValueChange={(v) => upd("country", v)}>
                <SelectTrigger data-testid="new-project-country-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-slate-400">
            Country is auto-detected from your browser and sets the currency ({currencyForCountry(form.country)}) — used to find local materials later.
          </p>

          <div className="grid gap-1.5 border-t border-slate-100 pt-3">
            <Label className="flex items-center gap-1.5 text-slate-700"><Sparkles className="h-3.5 w-3.5 text-[#1E56A0]" /> Or start from a template</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {HOUSE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={saving}
                  onClick={() => submit(t.id)}
                  data-testid={`new-project-template-${t.id}`}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-[#1E56A0] hover:bg-[#EFF6FF] disabled:opacity-50"
                >
                  <div className="font-medium text-slate-800">{t.label}</div>
                  <div className="font-mono text-xs text-slate-500">{t.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => submit(null)} disabled={saving} data-testid="new-project-create-button" className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <SquarePen className="h-4 w-4 mr-1.5" />}
            Create Blank Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
