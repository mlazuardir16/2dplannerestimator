import { Fragment, useState } from "react";
import { formatRupiah, fmtId, fmtPct } from "@/lib/format";
import { NumberField, Page, ReferenceBadge, ResetButton, SourceBadge, setRabTemplateValue, stageLabel, useRabPatch } from "./common";

const MODES = [
  { id: "swakelola", label: "RAB Swakelola", hint: "Dikerjakan sendiri: bahan + upah, tanpa margin kontraktor." },
  { id: "borongan", label: "RAB Borongan", hint: "Pakai kontraktor: bahan + upah + margin kontraktor." },
];

export default function RabTableView({ rab }) {
  const [mode, setMode] = useState("borongan");
  const patch = useRabPatch();
  const { result, templateInfo, catalog, built } = rab;
  const isBorongan = mode === "borongan";
  const totals = result[mode];
  const itemsByCode = Object.fromEntries(templateInfo.items.map((i) => [i.code, i]));
  const volumeLabel = Object.fromEntries(templateInfo.volumes.map((v) => [v.key, v.label]));

  const setItemVolume = (code, value) =>
    patch((r) => setRabTemplateValue(r, "itemVolumes", built.template, code, value));

  const lineTotal = (l) => (isBorongan ? l.borongan : l.swakelola);
  const jumlah = result.lines.reduce((s, l) => s + lineTotal(l), 0);

  return (
    <Page
      title={MODES.find((m) => m.id === mode).label}
      subtitle={MODES.find((m) => m.id === mode).hint}
      testid="rab-table-view"
      wide
      actions={
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)} data-testid={`rab-mode-${m.id}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === m.id ? "bg-white text-[#1E56A0] shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
              {m.id === "swakelola" ? "Swakelola" : "Borongan"}
            </button>
          ))}
        </div>
      }
    >
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full whitespace-nowrap text-xs">
          <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">No</th>
              <th className="px-3 py-2 font-medium">Pekerjaan</th>
              <th className="px-3 py-2 text-right font-medium">Volume</th>
              <th className="px-3 py-2 font-medium">Sat</th>
              <th className="px-3 py-2 text-right font-medium">Bahan / sat</th>
              <th className="px-3 py-2 text-right font-medium">Upah / sat</th>
              {isBorongan && <th className="px-3 py-2 text-right font-medium">Margin / sat</th>}
              <th className="px-3 py-2 text-right font-medium">Harga satuan</th>
              <th className="px-3 py-2 text-right font-medium">Jumlah</th>
              <th className="px-3 py-2 font-medium">Referensi</th>
              <th className="px-3 py-2 font-medium">Tipe item</th>
            </tr>
          </thead>
          <tbody>
            {catalog.stages.map((stage) => {
              const lines = result.lines.filter((l) => l.group === stage.code);
              if (!lines.length) return null;
              return (
                <Fragment key={stage.code}>
                  <tr className="border-t border-slate-200 bg-slate-50/60 font-semibold text-slate-800">
                    <td className="px-3 py-2" colSpan={isBorongan ? 8 : 7}>{stageLabel(catalog.stages, stage.code)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatRupiah(result.stage_totals[stage.code][mode])}</td>
                    <td colSpan={2} />
                  </tr>
                  {lines.map((l) => {
                    const item = itemsByCode[l.code];
                    const source = built.itemSources[l.code];
                    const unitPrice = l.bahan_unit + l.upah_unit + (isBorongan ? l.margin_unit : 0);
                    return (
                      <tr key={l.code} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`rab-line-${l.code}`}>
                        <td className="px-3 py-1.5 font-mono text-slate-500">{l.code}</td>
                        <td className="min-w-[240px] whitespace-normal px-3 py-1.5 text-slate-800">
                          {l.name}
                          {item?.installed && <span className="ml-1.5 text-[10px] text-slate-400">terpasang</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {item?.volume_key ? (
                            <span className="font-mono" title={`Dari volume ${item.volume_key} — ${volumeLabel[item.volume_key] || ""} (ubah di tab Input)`}>
                              {fmtId(l.volume, 2)} <span className="text-[10px] text-slate-400">{item.volume_key}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <SourceBadge source={source} />
                              <NumberField value={l.volume} onCommit={(v) => setItemVolume(l.code, v)} className="w-16" testid={`rab-volume-${l.code}`} />
                              {source === "manual" && <ResetButton onClick={() => setItemVolume(l.code, null)} />}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-slate-500">{l.unit}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatRupiah(l.bahan_unit)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatRupiah(l.upah_unit)}</td>
                        {isBorongan && <td className="px-3 py-1.5 text-right font-mono">{formatRupiah(l.margin_unit)}</td>}
                        <td className="px-3 py-1.5 text-right font-mono">{formatRupiah(unitPrice)}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-medium">{formatRupiah(lineTotal(l))}</td>
                        <td className="px-3 py-1.5"><ReferenceBadge reference={l.reference} /></td>
                        <td className={`px-3 py-1.5 ${l.item_type === "Tambahan" ? "text-purple-700" : "text-slate-500"}`}>{l.item_type}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 font-mono">
            <FootRow label="JUMLAH PEKERJAAN" value={jumlah} span={isBorongan ? 8 : 7} />
            {!isBorongan && <FootRow label={`Ongkos kirim & bongkar bahan non-curah (${fmtPct(result.parameters.delivery_non_bulk, 0)})`} value={totals.delivery} span={7} />}
            {isBorongan && <FootRow label={`di antaranya margin kontraktor ${fmtPct(result.parameters.margin, 0)}`} value={result.lines.reduce((s, l) => s + l.margin, 0)} span={8} muted />}
            <FootRow label="SUBTOTAL" value={totals.subtotal} span={isBorongan ? 8 : 7} />
            <FootRow label={`Dana cadangan (${fmtPct(result.parameters[isBorongan ? "contingency_borongan" : "contingency_swakelola"], 0)})`} value={totals.contingency} span={isBorongan ? 8 : 7} />
            <FootRow label={isBorongan ? "PPN 11% (hanya bila kontraktor PKP)" : "PPN membangun sendiri 2,2% (hanya bila luas ≥ 200 m²)"} value={totals.tax} span={isBorongan ? 8 : 7} />
            <FootRow label="TOTAL" value={totals.total} span={isBorongan ? 8 : 7} strong />
          </tfoot>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Volume bertanda <SourceBadge source="denah" /> dihitung dari denah, <SourceBadge source="template" /> memakai nilai template, <SourceBadge source="manual" /> diisi manual.
        Volume dengan kode (mis. GL) mengikuti tab Input.
      </p>
    </Page>
  );
}

function FootRow({ label, value, span, strong, muted }) {
  return (
    <tr className={`${strong ? "bg-slate-50 text-sm font-bold text-[#1E56A0]" : muted ? "text-slate-400" : "text-slate-700"}`}>
      <td className="px-3 py-1.5 text-right font-sans" colSpan={span}>{label}</td>
      <td className="px-3 py-1.5 text-right">{formatRupiah(value)}</td>
      <td colSpan={2} />
    </tr>
  );
}
