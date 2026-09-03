import React, { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, friendly } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useRows, DataTable, NativeSelect } from "@/components/Crud";
import { money, fmtDate, today, titleCase, UNITS, BRAND } from "@/lib/fmt";
import { exportPDF } from "@/lib/exports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, Archive } from "lucide-react";

const emptyItem = (category) => ({ description: "", unit: "nos", quantity: 1, rate: 0, category });

/**
 * Shared editor + list for invoices and quotations.
 * kind = "invoice" | "quotation"
 */
export const DocumentModule = ({ kind }) => {
  const isInvoice = kind === "invoice";
  const table = isInvoice ? "invoices" : "quotations";
  const itemsTable = isInvoice ? "invoice_items" : "quotation_items";
  const fk = isInvoice ? "invoice_id" : "quotation_id";
  const noField = isInvoice ? "invoice_no" : "quotation_no";
  const statuses = isInvoice
    ? ["draft", "sent", "partially_paid", "paid", "overdue", "cancelled"]
    : ["draft", "sent", "accepted", "rejected", "expired"];

  const { can, canDelete, profile } = useAuth();
  const qc = useQueryClient();
  const writable = can(isInvoice ? "incomes" : "reports", "w");

  const { data: docs, isLoading } = useRows(table, { order: { column: "date", ascending: false } });
  const { data: allItems } = useRows(itemsTable, { order: { column: "sort_order", ascending: true } });
  const { data: projects } = useRows("projects", { order: { column: "name", ascending: true } });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [head, setHead] = useState({});
  const [items, setItems] = useState([emptyItem("work")]);

  const itemsOf = (id) => (allItems || []).filter((i) => i[fk] === id);

  const totals = useMemo(() => {
    const subtotal = items.reduce((a, i) => a + Number(i.quantity || 0) * Number(i.rate || 0), 0);
    const discount = Number(head.discount || 0);
    const taxAmount = ((subtotal - discount) * Number(head.tax_percent || 0)) / 100;
    return { subtotal, discount, taxAmount, total: subtotal - discount + taxAmount };
  }, [items, head.discount, head.tax_percent]);

  const startNew = () => {
    setEditing(null);
    setHead({ date: today(), status: "draft", tax_percent: 18, discount: 0, client_name: "", project_id: "" });
    setItems([emptyItem("work")]);
    setOpen(true);
  };

  const startEdit = (row) => {
    setEditing(row);
    setHead({ ...row });
    const ex = itemsOf(row.id);
    setItems(ex.length ? ex.map((i) => ({ ...i })) : [emptyItem("work")]);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!head.project_id) throw new Error("Select a project");
      const clean = items.filter((i) => i.description?.trim());
      if (!clean.length) throw new Error("Add at least one line item");

      const payload = {
        project_id: head.project_id, client_name: head.client_name || null,
        date: head.date || today(), status: head.status || "draft",
        subtotal: totals.subtotal, tax_percent: Number(head.tax_percent || 0),
        tax_amount: totals.taxAmount, discount: totals.discount, total: totals.total,
        notes: head.notes || null, terms: head.terms || null,
        ...(isInvoice
          ? { due_date: head.due_date || null, paid_amount: Number(head.paid_amount || 0) }
          : { valid_until: head.valid_until || null }),
      };

      let docId = editing?.id;
      if (editing) {
        const { error } = await supabase.from(table).update(payload).eq("id", editing.id);
        if (error) throw error;
        await supabase.from(itemsTable).delete().eq(fk, editing.id);
      } else {
        const { data, error } = await supabase.from(table).insert(payload).select().maybeSingle();
        if (error) throw error;
        docId = data.id;
      }

      const rows = clean.map((i, idx) => ({
        [fk]: docId, description: i.description, unit: i.unit || null,
        quantity: Number(i.quantity || 0), rate: Number(i.rate || 0),
        amount: Number(i.quantity || 0) * Number(i.rate || 0), sort_order: idx,
        ...(isInvoice ? {} : { category: i.category || "work" }),
      }));
      const { error: iErr } = await supabase.from(itemsTable).insert(rows);
      if (iErr) throw iErr;

      await supabase.from("audit_logs").insert({
        action: editing ? "updated" : "created", table_name: table, record_id: docId,
        project_id: head.project_id, user_name: profile?.full_name,
        old_value: editing || null, new_value: payload,
      });
    },
    onSuccess: () => { toast.success(`${titleCase(kind)} saved successfully.`); setOpen(false); qc.invalidateQueries(); },
    onError: (e) => toast.error(friendly(e, e.message || `Unable to save ${kind}.`)),
  });

  const act = useMutation({
    mutationFn: async ({ row, mode }) => {
      if (mode === "delete") {
        const { error } = await supabase.from(table).delete().eq("id", row.id);
        if (error) throw error;
      } else {
        const patch = mode === "archive"
          ? { archived_at: new Date().toISOString(), archived_by: profile?.id }
          : { archived_at: null, archived_by: null };
        const { error } = await supabase.from(table).update(patch).eq("id", row.id);
        if (error) throw error;
      }
      await supabase.from("audit_logs").insert({
        action: mode === "delete" ? "deleted" : mode === "archive" ? "archived" : "restored",
        table_name: table, record_id: row.id, project_id: row.project_id,
        user_name: profile?.full_name, old_value: row,
      });
    },
    onSuccess: () => { toast.success("Done."); setConfirm(null); qc.invalidateQueries(); },
    onError: (e) => { toast.error(friendly(e, "Unable to complete this action.")); setConfirm(null); },
  });

  const pdf = (row) => {
    const rows = itemsOf(row.id);
    const project = projects?.find((p) => p.id === row.project_id);
    exportPDF({
      filename: `PMC-${row[noField]}`,
      title: isInvoice ? `INVOICE ${row[noField]}` : `QUOTATION ${row[noField]}`,
      meta: [
        `Client: ${row.client_name || "—"}`,
        `Project: ${project?.name || "—"}${project?.code ? ` (${project.code})` : ""}`,
        `Date: ${fmtDate(row.date)}`,
        isInvoice ? `Due date: ${fmtDate(row.due_date)}` : `Valid until: ${fmtDate(row.valid_until)}`,
        `Status: ${titleCase(row.status)}`,
        `Generated by: ${profile?.full_name || "—"}`,
      ],
      columns: [
        ...(isInvoice ? [] : [{ key: "category", label: "Type", value: (r) => titleCase(r.category) }]),
        { key: "description", label: "Description" },
        { key: "unit", label: "Unit" },
        { key: "quantity", label: "Qty" },
        { key: "rate", label: "Rate", value: (r) => money(r.rate) },
        { key: "amount", label: "Amount", value: (r) => money(r.amount) },
      ],
      rows,
      totals: [
        { label: "Subtotal", value: money(row.subtotal) },
        { label: "Discount", value: money(row.discount) },
        { label: `Tax (${row.tax_percent}%)`, value: money(row.tax_amount) },
        { label: "Grand Total", value: money(row.total) },
        ...(isInvoice
          ? [{ label: "Paid", value: money(row.paid_amount) }, { label: "Balance Due", value: money(Number(row.total) - Number(row.paid_amount)) }]
          : [{ label: "Terms", value: row.terms || "As discussed" }]),
      ],
    });
  };

  const setItem = (idx, key, val) => setItems((p) => p.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));

  return (
    <div className="space-y-5 fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{isInvoice ? "Invoices" : "Quotations"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isInvoice ? "Client invoices with line items, tax, discount and balance tracking" : "Estimates for work, materials, labour and transportation"} · branded PDF
          </p>
        </div>
        {writable && (
          <Button className="rounded-full" onClick={startNew} data-testid={`add-${kind}-btn`}>
            <Plus className="mr-1.5 h-4 w-4" /> New {titleCase(kind)}
          </Button>
        )}
      </div>

      <DataTable
        testId={`${kind}-table`}
        loading={isLoading}
        rows={docs || []}
        empty={`No ${kind}s created yet`}
        columns={[
          { key: noField, label: "Number", render: (r) => <span className="mono text-xs text-primary">{r[noField]}</span> },
          { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
          { key: "client_name", label: "Client", render: (r) => r.client_name || "—" },
          { key: "project", label: "Project", render: (r) => projects?.find((p) => p.id === r.project_id)?.name || "—" },
          { key: "total", label: "Total", render: (r) => <span className="mono">{money(r.total)}</span> },
          ...(isInvoice ? [{ key: "balance", label: "Balance", render: (r) => <span className="mono text-primary">{money(Number(r.total) - Number(r.paid_amount))}</span> }] : []),
          { key: "status", label: "Status", render: (r) => <span className="capitalize">{String(r.status).replace(/_/g, " ")}{r.archived_at ? " · archived" : ""}</span> },
        ]}
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            <Button size="icon" variant="ghost" onClick={() => pdf(r)} data-testid={`pdf-${r.id}`}><FileText className="h-4 w-4" /></Button>
            {writable && !r.archived_at && <Button size="icon" variant="ghost" onClick={() => startEdit(r)} data-testid={`edit-${r.id}`}><Pencil className="h-4 w-4" /></Button>}
            {writable && <Button size="icon" variant="ghost" onClick={() => setConfirm({ row: r, mode: r.archived_at ? "restore" : "archive" })} data-testid={`archive-${r.id}`}><Archive className="h-4 w-4" /></Button>}
            {canDelete() && <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setConfirm({ row: r, mode: "delete" })} data-testid={`delete-${r.id}`}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid={`${kind}-form`}>
          <DialogHeader><DialogTitle className="font-display">{editing ? `Edit ${titleCase(kind)} ${editing[noField]}` : `New ${titleCase(kind)}`}</DialogTitle></DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="label-xs mb-1.5 block">Project <span className="text-primary">*</span></Label>
              <NativeSelect testId="doc-project" value={head.project_id} onChange={(v) => setHead((p) => ({ ...p, project_id: v }))}
                options={(projects || []).filter((p) => !p.archived_at).map((p) => ({ value: p.id, label: p.name }))} />
            </div>
            <div>
              <Label className="label-xs mb-1.5 block">Client</Label>
              <Input data-testid="doc-client" value={head.client_name || ""} onChange={(e) => setHead((p) => ({ ...p, client_name: e.target.value }))} className="bg-secondary/50" />
            </div>
            <div>
              <Label className="label-xs mb-1.5 block">Date</Label>
              <Input data-testid="doc-date" type="date" value={head.date || ""} onChange={(e) => setHead((p) => ({ ...p, date: e.target.value }))} className="bg-secondary/50" />
            </div>
            <div>
              <Label className="label-xs mb-1.5 block">{isInvoice ? "Due Date" : "Valid Until"}</Label>
              <Input data-testid="doc-duedate" type="date" value={(isInvoice ? head.due_date : head.valid_until) || ""}
                onChange={(e) => setHead((p) => ({ ...p, [isInvoice ? "due_date" : "valid_until"]: e.target.value }))} className="bg-secondary/50" />
            </div>
            <div>
              <Label className="label-xs mb-1.5 block">Status</Label>
              <NativeSelect testId="doc-status" value={head.status} onChange={(v) => setHead((p) => ({ ...p, status: v }))}
                options={statuses.map((s) => ({ value: s, label: titleCase(s) }))} />
            </div>
            {isInvoice && (
              <div>
                <Label className="label-xs mb-1.5 block">Paid Amount (₹)</Label>
                <Input data-testid="doc-paid" type="number" inputMode="decimal" value={head.paid_amount ?? 0}
                  onChange={(e) => setHead((p) => ({ ...p, paid_amount: e.target.value }))} className="bg-secondary/50" />
              </div>
            )}
          </div>

          <div className="mt-2 space-y-2">
            <p className="label-xs">Line items</p>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-2 rounded-xl bg-secondary/30 p-3 sm:grid-cols-12" data-testid={`item-row-${idx}`}>
                {!isInvoice && (
                  <div className="sm:col-span-2">
                    <NativeSelect testId={`item-cat-${idx}`} value={it.category} onChange={(v) => setItem(idx, "category", v)}
                      options={["work", "material", "labor", "transportation", "other"].map((c) => ({ value: c, label: titleCase(c) }))} />
                  </div>
                )}
                <Input data-testid={`item-desc-${idx}`} placeholder="Description" value={it.description}
                  onChange={(e) => setItem(idx, "description", e.target.value)} className={`bg-secondary/50 ${isInvoice ? "sm:col-span-5" : "sm:col-span-4"}`} />
                <div className="sm:col-span-2">
                  <NativeSelect testId={`item-unit-${idx}`} value={it.unit} onChange={(v) => setItem(idx, "unit", v)} options={UNITS.map((u) => ({ value: u, label: u }))} />
                </div>
                <Input data-testid={`item-qty-${idx}`} type="number" inputMode="decimal" placeholder="Qty" value={it.quantity}
                  onChange={(e) => setItem(idx, "quantity", e.target.value)} className="bg-secondary/50 sm:col-span-1" />
                <Input data-testid={`item-rate-${idx}`} type="number" inputMode="decimal" placeholder="Rate" value={it.rate}
                  onChange={(e) => setItem(idx, "rate", e.target.value)} className="bg-secondary/50 sm:col-span-2" />
                <div className="flex items-center justify-between gap-1 sm:col-span-1">
                  <span className="mono text-xs">{money(Number(it.quantity || 0) * Number(it.rate || 0))}</span>
                  <Button size="icon" variant="ghost" data-testid={`item-remove-${idx}`} onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setItems((p) => [...p, emptyItem("work")])} data-testid="add-item-btn">
              <Plus className="mr-1 h-3.5 w-3.5" /> Add item
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div>
                <Label className="label-xs mb-1.5 block">Discount (₹)</Label>
                <Input data-testid="doc-discount" type="number" inputMode="decimal" value={head.discount ?? 0}
                  onChange={(e) => setHead((p) => ({ ...p, discount: e.target.value }))} className="bg-secondary/50" />
              </div>
              <div>
                <Label className="label-xs mb-1.5 block">Tax %</Label>
                <Input data-testid="doc-tax" type="number" inputMode="decimal" value={head.tax_percent ?? 0}
                  onChange={(e) => setHead((p) => ({ ...p, tax_percent: e.target.value }))} className="bg-secondary/50" />
              </div>
              <div>
                <Label className="label-xs mb-1.5 block">Terms</Label>
                <Textarea data-testid="doc-terms" rows={2} value={head.terms || ""} onChange={(e) => setHead((p) => ({ ...p, terms: e.target.value }))} className="bg-secondary/50" />
              </div>
            </div>
            <div className="panel space-y-2 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="mono">{money(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="mono">− {money(totals.discount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="mono">{money(totals.taxAmount)}</span></div>
              <div className="flex justify-between border-t border-border/60 pt-2 font-display text-base"><span>Grand Total</span><span className="mono text-primary" data-testid="doc-total">{money(totals.total)}</span></div>
              <p className="pt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{BRAND.name} · {BRAND.by}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} data-testid="doc-cancel">Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="doc-save">{save.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent data-testid="doc-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {confirm?.mode === "delete" ? "Permanently delete?" : confirm?.mode === "archive" ? "Archive this document?" : "Restore this document?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.mode === "delete" ? "This removes the document and its line items permanently." : "Archived documents stay searchable and available in reports."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="doc-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="doc-confirm-ok" onClick={() => act.mutate(confirm)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
