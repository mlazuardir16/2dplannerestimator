import { formatRupiah, fmtId, fmtPct } from "@/lib/format";
import { Card, NumberField, Page, ReferenceBadge, ResetButton, setRabValue, useRabPatch } from "./common";

export default function BahanView({ rab }) {
  const patch = useRabPatch();
  const { result, templateInfo, catalog } = rab;
  const catalogByCode = Object.fromEntries(catalog.materials.map((m) => [m.code, m]));
  const overrides = rab.built.request.material_prices;

  const setPrice = (code, value) => patch((r) => setRabValue(r, "materialPrices", code, value));

  const materials = result.materials;
  const totalCost = materials.reduce((s, m) => s + m.cost, 0);
  const bulkCost = materials.filter((m) => m.bulk).reduce((s, m) => s + m.cost, 0);

  const installedCodes = new Set(templateInfo.items.filter((i) => i.installed).map((i) => i.code));
  const installed = result.lines.filter((l) => installedCodes.has(l.code));
  const installedTotal = installed.reduce((s, l) => s + l.bahan, 0);

  return (
    <Page
      title="Perhitungan Bahan"
      subtitle="Kebutuhan = volume × koefisien (sudah termasuk susut). Jumlah beli dibulatkan ke kemasan — hanya panduan belanja; biaya dihitung dari kebutuhan."
      testid="rab-bahan-view"
    >
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full whitespace-nowrap text-xs">
          <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Kode</th>
              <th className="px-3 py-2 font-medium">Bahan</th>
              <th className="px-3 py-2 text-right font-medium">Kebutuhan</th>
              <th className="px-3 py-2 font-medium">Kemasan beli</th>
              <th className="px-3 py-2 text-right font-medium">Jumlah beli</th>
              <th className="px-3 py-2 text-right font-medium">Harga / kemasan</th>
              <th className="px-3 py-2 text-right font-medium">Harga / satuan</th>
              <th className="px-3 py-2 text-right font-medium">Biaya</th>
              <th className="px-3 py-2 font-medium">Referensi</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => {
              const meta = catalogByCode[m.code] || {};
              const pricePerPack = m.price_base * m.pack_size;
              return (
                <tr key={m.code} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`bahan-row-${m.code}`}>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{m.code}</td>
                  <td className="px-3 py-1.5">
                    <div className="text-slate-800">{m.name}{m.bulk && <span className="ml-1.5 text-[10px] text-slate-400">curah</span>}</div>
                    {meta.spec && <div className="text-[11px] text-slate-400">{meta.spec}</div>}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtId(m.qty, 2)} {m.base_unit}</td>
                  <td className="px-3 py-1.5 text-slate-600">{m.pack}{m.pack_size !== 1 && <span className="text-slate-400"> ({fmtId(m.pack_size, 2)} {m.base_unit})</span>}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-medium">{fmtId(m.packs, 0)}</td>
                  <td className="px-3 py-1.5 text-right">
                    <span className="inline-flex items-center gap-1">
                      {overrides[m.code] != null && <ResetButton onClick={() => setPrice(m.code, null)} title="Kembalikan ke harga acuan" />}
                      <NumberField value={pricePerPack} onCommit={(v) => setPrice(m.code, v)} className="w-28" testid={`bahan-price-${m.code}`} />
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-slate-500">{formatRupiah(m.price_base)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-medium">{formatRupiah(m.cost)}</td>
                  <td className="px-3 py-1.5"><ReferenceBadge reference={m.reference} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-300">
            <tr className="font-semibold">
              <td className="px-3 py-2 text-right" colSpan={7}>TOTAL BELANJA BAHAN</td>
              <td className="px-3 py-2 text-right font-mono">{formatRupiah(totalCost)}</td>
              <td />
            </tr>
            <tr className="text-slate-500">
              <td className="px-3 py-1.5 text-right" colSpan={7}>di antaranya bahan curah (sudah termasuk kirim)</td>
              <td className="px-3 py-1.5 text-right font-mono">{formatRupiah(bulkCost)}</td>
              <td />
            </tr>
            <tr className="text-slate-500">
              <td className="px-3 py-1.5 text-right" colSpan={7}>Ongkos kirim swakelola ({fmtPct(result.parameters.delivery_non_bulk, 0)} × bahan non-curah)</td>
              <td className="px-3 py-1.5 text-right font-mono">{formatRupiah(result.swakelola.delivery)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <Card title="Pekerjaan terpasang" subtitle="Beli dari toko/aplikator — harga sudah termasuk jasa pasang, jadi tidak ada upah tukang." className="mt-5">
        <table className="w-full text-xs">
          <thead className="text-left uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-2 font-medium">Pekerjaan</th>
              <th className="py-2 text-right font-medium">Volume</th>
              <th className="py-2 text-right font-medium">Harga terpasang / sat</th>
              <th className="py-2 text-right font-medium">Biaya</th>
              <th className="py-2 pl-3 font-medium">Referensi</th>
            </tr>
          </thead>
          <tbody>
            {installed.map((l) => (
              <tr key={l.code} className="border-b border-slate-100">
                <td className="py-1.5 text-slate-800">{l.name}</td>
                <td className="py-1.5 text-right font-mono">{fmtId(l.volume, 2)} {l.unit}</td>
                <td className="py-1.5 text-right font-mono">{formatRupiah(l.bahan_unit)}</td>
                <td className="py-1.5 text-right font-mono">{formatRupiah(l.bahan)}</td>
                <td className="py-1.5 pl-3"><ReferenceBadge reference={l.reference} /></td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2" colSpan={3}>TOTAL PEKERJAAN TERPASANG</td>
              <td className="py-2 text-right font-mono">{formatRupiah(installedTotal)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </Card>
    </Page>
  );
}
