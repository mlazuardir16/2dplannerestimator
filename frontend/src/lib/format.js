export function formatMoney(value, currency = "USD") {
  if (currency === "IDR") return formatRupiah(value);
  const v = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(v);
  } catch (e) {
    return "$" + Math.round(v).toLocaleString("en-US");
  }
}

export function fmtNum(value, digits = 2) {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (e) {
    return "—";
  }
}

// Indonesian formatting for the Buildora RAB screens: "Rp 244.786.045".
export function formatRupiah(value) {
  const v = Number.isFinite(value) ? value : 0;
  return "Rp " + Math.round(v).toLocaleString("id-ID");
}

export function fmtId(value, digits = 2) {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function fmtPct(fraction, digits = 1) {
  const v = Number.isFinite(fraction) ? fraction : 0;
  return (v * 100).toLocaleString("id-ID", { maximumFractionDigits: digits }) + "%";
}
