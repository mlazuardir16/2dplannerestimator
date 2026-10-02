import { formatRupiah, fmtId, fmtPct } from "@/lib/format";
import { Card, Page, stageLabel } from "./common";
import { CalendarDays, Hammer, HardHat, Home } from "lucide-react";

const STATUS_OK = "Dalam rentang pasar";

export default function RekapView({ rab }) {
  const { result, templateInfo, catalog } = rab;
  const installed = new Set(templateInfo.items.filter((i) => i.installed).map((i) => i.code));
  const sumLines = (pred, f) => result.lines.filter(pred).reduce((s, l) => s + f(l), 0);

  const bahan = sumLines((l) => !installed.has(l.code), (l) => l.bahan);
  const terpasang = sumLines((l) => installed.has(l.code), (l) => l.bahan);
  const margin = sumLines(() => true, (l) => l.margin);
  const marginPct = result.parameters.margin;
  const pkp = Boolean(result.parameters.contractor_pkp);
  const { swakelola: sw, borongan: br } = result;

  const rows = [
    ["Bahan bangunan", bahan, bahan, "Sama untuk kedua cara — rincian di tab Bahan"],
    ["Pekerjaan terpasang (toko/aplikator)", terpasang, terpasang, "Baja ringan, kusen & jendela aluminium, septictank, kanopi, pagar"],
    ["Upah tukang", result.upah_total, result.upah_total, "Sama untuk kedua cara — rincian di tab Upah"],
    ["Ongkos kirim bahan", sw.delivery, null, `Swakelola: ${fmtPct(result.parameters.delivery_non_bulk, 0)} bahan non-curah. Borongan: termasuk margin`],
    ["Margin kontraktor", null, margin, `Overhead + keuntungan kontraktor ${fmtPct(marginPct, 0)} (tidak ada di swakelola)`],
    ["Dana cadangan", sw.contingency, br.contingency, `Swakelola ${fmtPct(result.parameters.contingency_swakelola, 0)}, borongan ${fmtPct(result.parameters.contingency_borongan, 0)}`],
    ["Pajak", sw.tax, br.tax, `Swakelola: PPN KMS bila ≥ 200 m². Borongan: PPN ${pkp ? "11% (kontraktor PKP)" : "— kontraktor bukan PKP"}`],
  ];

  const checks = [
    ["Borongan — per m² pekerjaan standar", result.price_check.borongan],
    ["Swakelola — per m² pekerjaan standar", result.price_check.swakelola],
    ["Upah per m² + margin (setara borongan jasa)", result.price_check.labor],
  ];

  return (
    <Page
      title="Rekap Biaya"
      subtitle={`Rumah ${templateInfo.floors} lantai · luas bangunan ${fmtId(result.building_area, 1)} m² · paket ${result.spec_class} · DKI Jakarta`}
      testid="rab-rekap-view"
    >
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Total icon={<Hammer className="h-5 w-5" />} label="Dikerjakan sendiri (swakelola)" value={sw.total}
          note="Beli bahan, cari & awasi tukang sendiri" testid="rekap-total-swakelola" />
        <Total icon={<HardHat className="h-5 w-5" />} label="Pakai kontraktor (borongan)" value={br.total} accent
          note="Hanya mengawasi hasil" testid="rekap-total-borongan" />
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-slate-500"><CalendarDays className="h-5 w-5" /><span className="text-xs font-medium uppercase tracking-wide">Lama pengerjaan</span></div>
          <div className="font-mono text-2xl font-bold text-slate-900" data-testid="rekap-duration">{result.duration_weeks} minggu</div>
          <div className="mt-1 text-xs text-slate-500">Tim {result.crew} orang · 6 hari kerja/minggu</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card title="Rincian" className="lg:col-span-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 font-medium">Komponen</th>
                <th className="py-2 text-right font-medium">Swakelola</th>
                <th className="py-2 text-right font-medium">Borongan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, a, b, note]) => (
                <tr key={label} className="border-b border-slate-100 align-top">
                  <td className="py-2">
                    <div className="text-slate-800">{label}</div>
                    <div className="text-[11px] text-slate-400">{note}</div>
                  </td>
                  <td className="whitespace-nowrap py-2 pl-3 text-right font-mono text-xs">{a == null ? "—" : formatRupiah(a)}</td>
                  <td className="whitespace-nowrap py-2 pl-3 text-right font-mono text-xs">{b == null ? "—" : formatRupiah(b)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2">TOTAL</td>
                <td className="py-2 text-right font-mono text-xs">{formatRupiah(sw.total)}</td>
                <td className="py-2 text-right font-mono text-xs text-[#1E56A0]">{formatRupiah(br.total)}</td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card title="Per tahap pekerjaan" subtitle="Sebelum ongkos kirim, dana cadangan & pajak" className="lg:col-span-2">
          <table className="w-full text-sm">
            <tbody>
              {catalog.stages.map((s) => {
                const t = result.stage_totals[s.code];
                const share = br.subtotal ? t.borongan / br.subtotal : 0;
                return (
                  <tr key={s.code} className="border-b border-slate-100">
                    <td className="py-1.5 text-xs text-slate-700">{stageLabel(catalog.stages, s.code)}</td>
                    <td className="w-24 py-1.5">
                      <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-[#1E56A0]" style={{ width: `${share * 100}%` }} /></div>
                    </td>
                    <td className="py-1.5 text-right font-mono text-xs">{formatRupiah(t.borongan)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Kontrol harga per m²" subtitle="Hanya pekerjaan standar bangunan utama — tanpa toren, pompa, shower set, dapur, carport, kanopi, pagar, ongkos kirim, cadangan & pajak." className="mt-5">
        <table className="w-full text-sm" data-testid="rekap-price-check">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 font-medium">Pemeriksaan</th>
              <th className="py-2 text-right font-medium">Nilai per m²</th>
              <th className="py-2 text-right font-medium">Rentang wajar</th>
              <th className="py-2 pl-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {checks.map(([label, c]) => (
              <tr key={label} className="border-b border-slate-100">
                <td className="py-2 text-slate-800">{label}</td>
                <td className="py-2 text-right font-mono text-xs">{formatRupiah(c.per_m2)}</td>
                <td className="py-2 text-right font-mono text-xs text-slate-500">{formatRupiah(c.low)} – {formatRupiah(c.high)}</td>
                <td className={`py-2 pl-4 text-xs ${c.status === STATUS_OK ? "text-emerald-700" : "text-amber-700"}`}>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
          <Home className="h-3.5 w-3.5" /> Rentang dari artikel pasar Jabodetabek 2026 — rambu, bukan patokan pasti. Hitungan struktur selalu berupa estimasi.
        </p>
      </Card>
    </Page>
  );
}

function Total({ icon, label, value, note, accent, testid }) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${accent ? "border-[#1E56A0] bg-[#1E56A0] text-white" : "border-slate-200 bg-white"}`}>
      <div className={`mb-2 flex items-center gap-2 ${accent ? "text-blue-100" : "text-slate-500"}`}>{icon}<span className="text-xs font-medium uppercase tracking-wide">{label}</span></div>
      <div className="font-mono text-2xl font-bold" data-testid={testid}>{formatRupiah(value)}</div>
      <div className={`mt-1 text-xs ${accent ? "text-blue-100" : "text-slate-500"}`}>{note}</div>
    </div>
  );
}
