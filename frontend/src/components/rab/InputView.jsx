import { fmtId } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, NumberField, Page, ResetButton, SourceBadge, setRabTemplateValue, setRabValue, useRabPatch } from "./common";

const SPEC_CLASSES = ["Sederhana", "Menengah", "Mewah"];

const PERCENT_PARAMS = [
  ["margin", "Margin kontraktor", "Hanya borongan: alat, transport, pengawasan, risiko & keuntungan. Wajar 10–25%."],
  ["contingency_swakelola", "Dana cadangan — swakelola", "Susut, salah beli, sewa alat, tukang lambat."],
  ["contingency_borongan", "Dana cadangan — borongan", "Sebagian risiko ditanggung kontraktor."],
  ["delivery_non_bulk", "Ongkos kirim bahan non-curah", "Swakelola saja. Pasir/batu & pekerjaan terpasang sudah termasuk kirim."],
];

export default function InputView({ rab }) {
  const patch = useRabPatch();
  const { result, templateInfo, catalog, built } = rab;
  const req = built.request;
  const param = (k) => req.parameters[k] ?? catalog.parameters[k];
  const setParam = (k, v) => patch((r) => setRabValue(r, "parameters", k, v));
  const setVolume = (key, v) => patch((r) => setRabTemplateValue(r, "volumes", built.template, key, v));

  const inputs = templateInfo.volumes.filter((v) => v.input);
  const derived = templateInfo.volumes.filter((v) => !v.input);
  const [lo, hi] = catalog.price_ranges[req.spec_class];

  return (
    <Page title="Input & Parameter" subtitle={`Rumus volume, koefisien & harga satuan mengikuti template referensi: ${templateInfo.description}`} testid="rab-input-view">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Kelas paket" subtitle="Menentukan rentang harga per m² di kontrol harga.">
          <Select value={req.spec_class} onValueChange={(v) => patch((r) => ({ ...r, specClass: v }))}>
            <SelectTrigger className="w-48" data-testid="input-spec-class"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SPEC_CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-slate-500">Rentang borongan {req.spec_class}: Rp {fmtId(lo, 0)} – Rp {fmtId(hi, 0)} per m²</p>
        </Card>

        <Card title="Parameter">
          <table className="w-full text-sm">
            <tbody>
              {PERCENT_PARAMS.map(([k, label, hint]) => (
                <tr key={k} className="border-b border-slate-100 align-top">
                  <td className="py-1.5">
                    <div className="text-slate-800">{label}</div>
                    <div className="text-[11px] text-slate-400">{hint}</div>
                  </td>
                  <td className="py-1.5 text-right">
                    <span className="inline-flex items-center gap-1">
                      {req.parameters[k] != null && <ResetButton onClick={() => setParam(k, null)} />}
                      <NumberField value={param(k) * 100} onCommit={(v) => setParam(k, v == null ? null : v / 100)} className="w-16" suffix="%" testid={`input-param-${k}`} />
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="align-top">
                <td className="py-1.5">
                  <div className="text-slate-800">Kontraktor PKP</div>
                  <div className="text-[11px] text-slate-400">Bila ya: PPN 11% atas nilai borongan.</div>
                </td>
                <td className="py-1.5 text-right">
                  <Switch checked={Boolean(param("contractor_pkp"))} onCheckedChange={(v) => setParam("contractor_pkp", v)} data-testid="input-param-pkp" />
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Volume — input" subtitle="Nilai otomatis dari denah bila bisa diukur; selain itu dari template. Isi manual untuk menimpa." className="mt-5">
        <table className="w-full text-xs">
          <thead className="text-left uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-2 font-medium">Kode</th>
              <th className="py-2 font-medium">Uraian</th>
              <th className="py-2 font-medium">Sumber</th>
              <th className="py-2 text-right font-medium">Nilai</th>
              <th className="py-2 pl-2 font-medium">Sat</th>
            </tr>
          </thead>
          <tbody>
            {inputs.map((v) => {
              const source = built.volumeSources[v.key];
              const auto = built.drawingVolumes[v.key] ?? v.default;
              return (
                <tr key={v.key} className="border-b border-slate-100">
                  <td className="py-1.5 font-mono text-slate-500">{v.key}</td>
                  <td className="py-1.5 text-slate-800">{v.label}</td>
                  <td className="py-1.5">
                    <SourceBadge source={source} />
                    {source === "manual" && <span className="ml-1.5 text-[10px] text-slate-400">otomatis: {fmtId(auto, 2)}</span>}
                  </td>
                  <td className="py-1.5 text-right">
                    <span className="inline-flex items-center gap-1">
                      {source === "manual" && <ResetButton onClick={() => setVolume(v.key, null)} />}
                      <NumberField value={result.volumes[v.key]} onCommit={(x) => setVolume(v.key, x)} className="w-20" testid={`input-volume-${v.key}`} />
                    </span>
                  </td>
                  <td className="py-1.5 pl-2 text-slate-500">{v.unit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Volume — turunan" subtitle="Dihitung otomatis dari input di atas (rumus sama dengan sheet Volume di workbook)." className="mt-5">
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          {derived.map((v) => (
            <div key={v.key} className="flex items-center justify-between border-b border-slate-100 py-1.5 text-xs">
              <span><span className="mr-2 font-mono text-slate-400">{v.key}</span><span className="text-slate-700">{v.label}</span></span>
              <span className="font-mono text-slate-900">{fmtId(result.volumes[v.key], 2)} <span className="text-slate-400">{v.unit}</span></span>
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
}
