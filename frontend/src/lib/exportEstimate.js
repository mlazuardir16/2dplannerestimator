import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLUMNS = ["No", "Item", "Category", "Volume", "Unit", "Unit Price", "Material", "Labor", "Total"];

function rowToArray(r) {
  return [r.no, r.name, r.category, r.volume.toFixed(2), r.unit, r.unitCost.toFixed(2), r.materialCost.toFixed(2), r.laborCost.toFixed(2), r.total.toFixed(2)];
}

function safeName(name) {
  return (name || "Project").replace(/\s+/g, "_");
}

function summaryRows(meta) {
  return [
    ["", "", "", "", "", "", "", "Subtotal", meta.subtotal.toFixed(2)],
    ["", "", "", "", "", "", "", `Overhead ${meta.overheadPct}%`, meta.overhead.toFixed(2)],
    ["", "", "", "", "", "", "", "Grand Total", meta.grandTotal.toFixed(2)],
  ];
}

// Sorts a copy of `rows` by `order` (an array of row ids). Rows not present
// in `order` keep their natural relative order and are appended at the end;
// stale ids in `order` with no matching row are simply ignored.
export function applyExportOrder(rows, order) {
  if (!order || !order.length) return rows;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean);
  const seen = new Set(ordered.map((r) => r.id));
  const rest = rows.filter((r) => !seen.has(r.id));
  return [...ordered, ...rest];
}

export function exportToCSV(rows, meta) {
  const lines = [COLUMNS.join(",")];
  rows.forEach((r) => lines.push(rowToArray(r).map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v)).join(",")));
  summaryRows(meta).forEach((r) => lines.push(r.join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  downloadBlob(blob, `${safeName(meta.projectName)}_BOQ.csv`);
}

export function exportToExcel(rows, meta) {
  const data = [COLUMNS, ...rows.map(rowToArray), [], ...summaryRows(meta)];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 5 }, { wch: 32 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bill of Quantities");
  XLSX.writeFile(wb, `${safeName(meta.projectName)}_BOQ.xlsx`);
}

export function exportToPDF(rows, meta) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(`Bill of Quantities — ${meta.projectName}`, 14, 15);
  autoTable(doc, {
    startY: 20,
    head: [COLUMNS],
    body: rows.map(rowToArray),
    foot: summaryRows(meta),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 86, 160] },
    footStyles: { fillColor: [239, 246, 255], textColor: [30, 86, 160], fontStyle: "bold" },
  });
  doc.save(`${safeName(meta.projectName)}_BOQ.pdf`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
