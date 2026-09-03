import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { money, fmtDate, titleCase, BRAND } from "@/lib/fmt";
import { signedUrl, downloadFile } from "@/lib/storage";
import { exportPDF } from "@/lib/exports";
import { toast } from "sonner";
import { Pencil, Copy, Archive, Eye, Download, Printer } from "lucide-react";

const Row = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 border-b border-border/40 py-2.5 last:border-0">
    <span className="label-xs pt-0.5">{label}</span>
    <span className="max-w-[62%] break-words text-right text-sm">{children ?? "—"}</span>
  </div>
);

/**
 * Full transaction detail drawer with Edit / Duplicate / Archive /
 * View receipt / Download receipt / Print actions.
 */
export const TransactionSheet = ({ open, onOpenChange, row, title, rows = [], amount, receipt, onEdit, onDuplicate, onArchive, canWrite, canArchive }) => {
  if (!row) return null;

  const view = async () => {
    try { window.open(await signedUrl(receipt), "_blank", "noopener"); }
    catch { toast.error("Unable to open the receipt."); }
  };

  const print = () => {
    exportPDF({
      filename: `PMC-${row.ref_no || "transaction"}`,
      title: `${title} — ${row.ref_no || row.po_no || row.report_no || row.code || ""}`,
      meta: [`Amount: ${amount !== null && amount !== undefined ? money(amount) : "—"}`, `Date: ${row.date ? fmtDate(row.date) : "—"}`, `Printed: ${fmtDate(new Date())}`],
      columns: [{ key: "field", label: "Field" }, { key: "value", label: "Value" }],
      rows: rows.map((r) => ({ field: r.label, value: String(r.text ?? "—") })),
      totals: [{ label: "Amount", value: amount !== null && amount !== undefined ? money(amount) : "—" }],
    });
    toast.success("Receipt PDF generated.");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md" data-testid="transaction-sheet">
        <SheetHeader>
          <SheetTitle className="font-display">{title}</SheetTitle>
        </SheetHeader>

        <div className="mt-2">
          <p className="mono text-xs text-primary" data-testid="tx-ref">{row.ref_no || row.po_no || row.report_no || row.code || row.id?.slice(0, 8)}</p>
          {amount !== null && amount !== undefined && <p className="stat-value mt-1" data-testid="tx-amount">{money(amount)}</p>}
          <p className="text-xs text-muted-foreground">{row.date ? fmtDate(row.date) : ""}{row.archived_at ? " · archived" : ""}</p>
        </div>

        <div className="mt-4">
          {rows.map((r) => <Row key={r.label} label={r.label}>{r.text}</Row>)}
          <Row label="Created">{row.created_at ? new Date(row.created_at).toLocaleString("en-IN") : "—"}</Row>
          <Row label="Updated">{row.updated_at ? new Date(row.updated_at).toLocaleString("en-IN") : "—"}</Row>
          <Row label="Notes">{row.notes}</Row>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {canWrite && !row.archived_at && (
            <Button variant="secondary" onClick={onEdit} data-testid="tx-edit"><Pencil className="mr-1.5 h-4 w-4" /> Edit</Button>
          )}
          {canWrite && (
            <Button variant="secondary" onClick={onDuplicate} data-testid="tx-duplicate"><Copy className="mr-1.5 h-4 w-4" /> Duplicate</Button>
          )}
          <Button variant="secondary" onClick={print} data-testid="tx-print"><Printer className="mr-1.5 h-4 w-4" /> Print</Button>
          {receipt && (
            <>
              <Button variant="secondary" onClick={view} data-testid="tx-view-receipt"><Eye className="mr-1.5 h-4 w-4" /> Receipt</Button>
              <Button variant="secondary" onClick={() => downloadFile(receipt, String(receipt).split("/").pop())} data-testid="tx-download-receipt">
                <Download className="mr-1.5 h-4 w-4" /> Download
              </Button>
            </>
          )}
          {canArchive && !row.archived_at && (
            <Button variant="ghost" className="text-destructive" onClick={onArchive} data-testid="tx-archive"><Archive className="mr-1.5 h-4 w-4" /> Archive</Button>
          )}
        </div>

        <p className="mt-6 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{BRAND.name} · {BRAND.by}</p>
      </SheetContent>
    </Sheet>
  );
};

export const detailRow = (label, text) => ({ label, text });
export const asTitle = titleCase;
