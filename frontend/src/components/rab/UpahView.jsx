import { Fragment } from "react";
import { formatRupiah, fmtId } from "@/lib/format";
import { Card, NumberField, Page, ResetButton, setRabValue, stageLabel, useRabPatch } from "./common";

export default function UpahView({ rab }) {
  const patch = useRabPatch();
  const { result, catalog } = rab;
  const overrides = rab.built.request.labor_rates;
  const rateOf = (code) => overrides[code] ?? catalog.labor_rates.find((r) => r.code === code)?.rate ?? 0;
  const nameOf = (code) => catalog.labor_rates.find((r) => r.code === code)?.name || code;
  const setRate = (code, value) => patch((r) => setRabValue(r, "laborRates", code, value));

  const stages = catalog.stages.filter((s) => result.labor_oh[s.code]);
  const totalOh = stages.reduce((s, st) => s + Object.values(result.labor_oh[st.code]).reduce((a, b) => a + b, 0), 0);

  return (
    <Page
      title="Perhitungan Upah Tukang"
      subtitle="Kebutuhan (orang-hari) = volume × koefisien. Upah = kebutuhan × upah per hari — sama untuk swakelola dan borongan."
      testid="rab-upah-view"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card title="Upah per hari" subtitle="Acuan DKI 2026 — isi sesuai tarif di lokasi Anda." className="lg:col-span-2">
          <table className="w-full text-sm">
            <tbody>
              {catalog.labor_rates.map((r) => (
                <tr key={r.code} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-800">{r.name}</td>
                  <td className="py-1.5 font-mono text-xs text-slate-400">{r.code}</td>
                  <td className="py-1.5 text-right">
                    <span className="inline-flex items-center gap-1">
                      {overrides[r.code] != null && <ResetButton onClick={() => setRate(r.code, null)} title="Kembalikan ke upah acuan" />}
                      <NumberField value={rateOf(r.code)} onCommit={(v) => setRate(r.code, v)} className="w-28" testid={`upah-rate-${r.code}`} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Ringkasan" className="lg:col-span-3">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Total upah" value={formatRupiah(result.upah_total)} testid="upah-total" />
            <Stat label="Total kebutuhan tenaga" value={`${fmtId(totalOh, 1)} orang-hari`} />
            <Stat label="Upah per m² + margin" value={formatRupiah(result.price_check.labor.per_m2)} />
            <Stat label="Status (borongan jasa)" value={result.price_check.labor.status} small />
          </div>
        </Card>
      </div>

      <Card title="Kebutuhan tenaga & upah per tahap" className="mt-5">
        <table className="w-full text-xs">
          <thead className="text-left uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-2 font-medium">Tahap / jenis tenaga</th>
              <th className="py-2 text-right font-medium">Kebutuhan (orang-hari)</th>
              <th className="py-2 text-right font-medium">Upah per hari</th>
              <th className="py-2 text-right font-medium">Upah</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => {
              const oh = result.labor_oh[s.code];
              const upah = result.labor_upah[s.code];
              const trades = Object.keys(oh).filter((t) => oh[t] > 0);
              const stageOh = trades.reduce((a, t) => a + oh[t], 0);
              const stageUpah = trades.reduce((a, t) => a + upah[t], 0);
              return (
                <Fragment key={s.code}>
                  <tr className="border-t border-slate-200 bg-slate-50/60 font-semibold text-slate-800">
                    <td className="py-1.5 pl-1">{stageLabel(catalog.stages, s.code)}</td>
                    <td className="py-1.5 text-right font-mono">{fmtId(stageOh, 2)}</td>
                    <td />
                    <td className="py-1.5 text-right font-mono">{formatRupiah(stageUpah)}</td>
                  </tr>
                  {trades.map((t) => (
                    <tr key={t} className="border-t border-slate-100 text-slate-600">
                      <td className="py-1 pl-5">{nameOf(t)}</td>
                      <td className="py-1 text-right font-mono">{fmtId(oh[t], 2)}</td>
                      <td className="py-1 text-right font-mono">{formatRupiah(rateOf(t))}</td>
                      <td className="py-1 text-right font-mono">{formatRupiah(upah[t])}</td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            <tr className="border-t-2 border-slate-300 font-bold">
              <td className="py-2">TOTAL</td>
              <td className="py-2 text-right font-mono">{fmtId(totalOh, 2)}</td>
              <td />
              <td className="py-2 text-right font-mono text-[#1E56A0]">{formatRupiah(result.upah_total)}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </Page>
  );
}

function Stat({ label, value, small, testid }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`font-mono font-bold text-slate-900 ${small ? "text-xs" : "text-lg"}`} data-testid={testid}>{value}</div>
    </div>
  );
}
