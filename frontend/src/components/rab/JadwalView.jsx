import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtId, fmtPct } from "@/lib/format";
import { Card, NumberField, Page, ResetButton, setRabValue, stageLabel, useRabPatch } from "./common";

const STATUS_STYLE = {
  TERLAMBAT: "bg-red-50 text-red-700 ring-red-200",
  "LEBIH CEPAT": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "SESUAI RENCANA": "bg-blue-50 text-[#1E56A0] ring-blue-200",
};

export default function JadwalView({ rab }) {
  const patch = useRabPatch();
  const { result, catalog } = rab;
  const req = rab.built.request;
  const weeks = result.duration_weeks;

  const setCrew = (v) => patch((r) => setRabValue(r, "parameters", "crew", v == null ? null : Math.max(1, Math.round(v))));
  const setProgress = (code, pct) =>
    patch((r) => setRabValue(r, "stageProgress", code, pct == null ? null : Math.min(100, Math.max(0, pct)) / 100));
  const setWeek = (v) => patch((r) => ({ ...r, currentWeek: v == null ? null : Math.max(1, Math.round(v)) }));

  const curve = result.s_curve.map((p) => ({ week: p.week, rencana: p.planned_cumulative * 100 }));
  const progress = result.progress;

  return (
    <Page title="Jadwal & Kurva-S" subtitle="Durasi tiap tahap = kebutuhan orang-hari ÷ jumlah orang per tim, 6 hari kerja per minggu." testid="rab-jadwal-view">
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Tim kerja">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            Jumlah orang per tim
            <NumberField value={result.crew} onCommit={setCrew} className="w-16" testid="jadwal-crew" />
            {req.parameters.crew != null && <ResetButton onClick={() => setCrew(null)} />}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Acuan: rumah 1 lantai 5 orang, 2 lantai 8 orang.</p>
        </Card>
        <Card title="Lama pengerjaan">
          <div className="font-mono text-2xl font-bold text-slate-900" data-testid="jadwal-duration">{weeks} minggu</div>
          <p className="mt-1 text-[11px] text-slate-400">Plumbing (X) dan listrik (XI) mulai bersamaan dengan cat (IX).</p>
        </Card>
        <Card title="Progres minggu berjalan">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            Minggu ke
            <NumberField value={req.current_week ?? null} onCommit={setWeek} className="w-16" testid="jadwal-current-week" />
          </div>
          {progress ? (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className={`rounded px-2 py-0.5 font-semibold ring-1 ring-inset ${STATUS_STYLE[progress.status]}`} data-testid="jadwal-status">{progress.status}</span>
              <span className="text-slate-500">rencana {fmtPct(progress.planned)} · realisasi {fmtPct(progress.actual)}</span>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-slate-400">Isi minggu berjalan dan progres tiap tahap di tabel bawah.</p>
          )}
        </Card>
      </div>

      <Card title="Jadwal per tahap" className="mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-2 font-medium">Tahap</th>
                <th className="py-2 text-right font-medium">Bobot</th>
                <th className="py-2 text-right font-medium">Orang-hari</th>
                <th className="py-2 text-right font-medium">Hari kerja</th>
                <th className="py-2 text-right font-medium">Minggu</th>
                <th className="py-2 pl-4 font-medium">Jadwal (minggu 1–{weeks})</th>
                <th className="py-2 text-right font-medium">Progres %</th>
              </tr>
            </thead>
            <tbody>
              {result.schedule.map((s) => (
                <tr key={s.code} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-800">{stageLabel(catalog.stages, s.code)}</td>
                  <td className="py-1.5 text-right font-mono">{fmtPct(s.weight)}</td>
                  <td className="py-1.5 text-right font-mono">{fmtId(s.oh, 1)}</td>
                  <td className="py-1.5 text-right font-mono">{s.days}</td>
                  <td className="py-1.5 text-right font-mono">{s.weeks}</td>
                  <td className="py-1.5 pl-4">
                    <div className="relative h-3 min-w-[240px] rounded bg-slate-100">
                      <div className="absolute h-3 rounded bg-[#1E56A0]/80"
                        style={{ left: `${((s.start_week - 1) / weeks) * 100}%`, width: `${(s.weeks / weeks) * 100}%` }}
                        title={`Minggu ${s.start_week}–${s.end_week}`} />
                    </div>
                  </td>
                  <td className="py-1.5 text-right">
                    <NumberField value={req.stage_progress[s.code] != null ? req.stage_progress[s.code] * 100 : null}
                      onCommit={(v) => setProgress(s.code, v)} className="w-14" testid={`jadwal-progress-${s.code}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Kurva-S" subtitle="Rencana kumulatif (bobot = biaya borongan tiap tahap ÷ total). Titik oranye = realisasi minggu berjalan.">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={curve} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} label={{ value: "Minggu", position: "insideBottom", offset: -5, fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v) => `${fmtId(v, 1)}%`} labelFormatter={(w) => `Minggu ${w}`} />
            <Line type="monotone" dataKey="rencana" name="Rencana" stroke="#1E56A0" strokeWidth={2} dot={false} />
            {progress && progress.week <= weeks && (
              <ReferenceDot x={progress.week} y={progress.actual * 100} r={5} fill="#D97706" stroke="white" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </Page>
  );
}
