import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { BRAND } from "./fmt";

export const exportCSV = (filename, rows) => {
  if (!rows?.length) return;
  const keys = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
};

export const exportExcel = (filename, rows, sheet = "Report") => {
  if (!rows?.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportPDF = ({ filename, title, meta = [], columns, rows, totals = [] }) => {
  const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" });
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(11, 14, 17);
  doc.rect(0, 0, w, 30, "F");
  doc.setTextColor(245, 165, 36);
  doc.setFontSize(16);
  doc.text(BRAND.name, 14, 13);
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text(BRAND.by, 14, 19);
  doc.text(BRAND.subtitle, 14, 25);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(13);
  doc.text(title, 14, 40);
  doc.setFontSize(9);
  let y = 46;
  meta.forEach((m) => { doc.text(m, 14, y); y += 5; });

  autoTable(doc, {
    startY: y + 2,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => (c.value ? c.value(r) : r[c.key] ?? ""))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [22, 27, 34], textColor: [245, 165, 36] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  let ty = doc.lastAutoTable.finalY + 8;
  totals.forEach((t) => { doc.setFontSize(10); doc.text(`${t.label}: ${t.value}`, 14, ty); ty += 6; });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`${BRAND.name} — ${BRAND.by}`, 14, doc.internal.pageSize.getHeight() - 8);
  doc.save(`${filename}.pdf`);
};

const triggerDownload = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};
