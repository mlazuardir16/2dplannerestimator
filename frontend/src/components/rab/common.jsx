import { useCallback, useEffect, useState } from "react";
import { useProjectStore } from "@/store/useProjectStore";
import { SOURCE } from "@/lib/rabInputs";
import { Loader2, RotateCcw, AlertTriangle } from "lucide-react";

// ---- saving edits into project.rab -------------------------------------

// project.rab = {
//   specClass, parameters: {margin, ...}, materialPrices: {code: price},
//   laborRates: {code: rate}, volumes: {template: {key: v}},
//   itemVolumes: {template: {code: v}}, stageProgress: {stage: 0..1}, currentWeek
// }
export function useRabPatch() {
  const patchProject = useProjectStore((s) => s.patchProject);
  return useCallback(
    (updater) => {
      const rab = useProjectStore.getState().project?.rab || {};
      patchProject({ rab: updater(rab) });
    },
    [patchProject]
  );
}

// Set (or with value == null, clear) rab[field][key], dropping empty maps.
export function setRabValue(rab, field, key, value) {
  const next = { ...(rab[field] || {}) };
  if (value == null) delete next[key];
  else next[key] = value;
  return { ...rab, [field]: next };
}

// Same, one level deeper: rab[field][template][key].
export function setRabTemplateValue(rab, field, template, key, value) {
  const perTemplate = { ...(rab[field]?.[template] || {}) };
  if (value == null) delete perTemplate[key];
  else perTemplate[key] = value;
  return { ...rab, [field]: { ...(rab[field] || {}), [template]: perTemplate } };
}

// ---- layout -------------------------------------------------------------

export function Page({ title, subtitle, actions, children, testid, wide = false }) {
  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-6 py-6" data-testid={testid}>
      <div className={`mx-auto ${wide ? "max-w-[1600px]" : "max-w-6xl"}`}>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Card({ title, subtitle, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h3 className="font-display text-sm font-semibold text-slate-900">{title}</h3>}
      {subtitle && <p className="mb-3 text-xs text-slate-500">{subtitle}</p>}
      {title && !subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

// Loading / unsupported / error states shared by every RAB tab.
export function RabGate({ rab, children }) {
  if (!rab.supported) {
    return (
      <Notice>
        Estimasi RAB saat ini mendukung rumah 1 lantai atau 2 lantai. Ubah jumlah lantai di Denah untuk melihat RAB.
      </Notice>
    );
  }
  if (rab.error && !rab.result) return <Notice tone="error">{rab.error}</Notice>;
  if (!rab.result || !rab.templateInfo) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menghitung RAB…
      </div>
    );
  }
  return children;
}

function Notice({ children, tone = "info" }) {
  const cls = tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-slate-300 bg-white text-slate-600";
  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-6">
      <div className={`flex max-w-md items-start gap-2 rounded-xl border border-dashed p-6 text-sm ${cls}`}>
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <div>{children}</div>
      </div>
    </div>
  );
}

// ---- small widgets ----------------------------------------------------------

const SOURCE_STYLE = {
  [SOURCE.manual]: { label: "manual", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  [SOURCE.drawing]: { label: "denah", cls: "bg-blue-50 text-[#1E56A0] ring-blue-200" },
  [SOURCE.template]: { label: "template", cls: "bg-slate-100 text-slate-500 ring-slate-200" },
};

export function SourceBadge({ source }) {
  const s = SOURCE_STYLE[source];
  if (!s) return null;
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${s.cls}`}>{s.label}</span>;
}

export function ReferenceBadge({ reference }) {
  const estimasi = reference === "Estimasi";
  return (
    <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium ${estimasi ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"}`}>
      {reference}
    </span>
  );
}

// Numeric input that commits on blur / Enter (not on every keystroke, which
// would trigger a recalculation per digit). Empty input commits null.
export function NumberField({ value, onCommit, className = "", testid, suffix }) {
  const [text, setText] = useState(fmtInput(value));
  useEffect(() => setText(fmtInput(value)), [value]);

  const commit = () => {
    const trimmed = text.trim().replace(",", ".");
    if (trimmed === "") return onCommit(null);
    const n = Number(trimmed);
    if (Number.isFinite(n) && n !== value) onCommit(n);
    else setText(fmtInput(value));
  };

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        data-testid={testid}
        className={`w-24 rounded-md border border-yellow-300 bg-yellow-50 px-2 py-1 text-right font-mono text-xs text-blue-800 focus:outline-none focus:ring-1 focus:ring-[#1E56A0] ${className}`}
      />
      {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
    </span>
  );
}

function fmtInput(v) {
  if (v == null || !Number.isFinite(v)) return "";
  return String(Math.round(v * 1e6) / 1e6);
}

export function ResetButton({ onClick, title = "Kembalikan ke nilai otomatis" }) {
  return (
    <button onClick={onClick} title={title} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
      <RotateCcw className="h-3.5 w-3.5" />
    </button>
  );
}

export function stageLabel(stages, code) {
  const s = stages.find((x) => x.code === code);
  return s ? `${s.code}. ${s.name}` : code;
}
