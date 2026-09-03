import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, friendly } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { CrudPage, useRows } from "@/components/Crud";
import { clean } from "@/lib/clean";
import { money, num, fmtDate, today, titleCase, UNITS } from "@/lib/fmt";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { PackageCheck, ArrowRight } from "lucide-react";

// requested → approved → ordered → received → billed → paid
const NEXT = { requested: "approved", approved: "ordered", ordered: "received", received: "billed", billed: "paid" };
const TONE = {
  requested: "bg-secondary/70 text-muted-foreground",
  approved: "bg-primary/15 text-primary",
  ordered: "bg-primary/20 text-primary",
  received: "bg-accent/15 text-accent",
  billed: "bg-accent/20 text-accent",
  paid: "bg-accent/25 text-accent",
  cancelled: "bg-destructive/20 text-destructive",
};

export default function PurchaseOrders() {
  const { can, role } = useAuth();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(null);
  const { data: materials } = useRows("materials", { order: { column: "name", ascending: true } });
  const writable = can("orders", "w");

  const advance = useMutation({
    mutationFn: async ({ row, to }) => {
      if (to === "received") {
        const { error } = await supabase.rpc("receive_purchase_order", {
          p_po_id: row.id, p_received_quantity: row.quantity, p_received_date: today(),
        });
        if (error) throw error;
        return;
      }
      const patch = { status: to };
      if (to === "billed") patch.bill_date = today();
      if (to === "paid") patch.paid_amount = row.total;
      const { error } = await supabase.from("purchase_orders").update(patch).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.to === "received"
        ? "Material received — stock and project expense updated."
        : `Marked as ${titleCase(v.to)}.`);
      setConfirm(null); qc.invalidateQueries();
    },
    onError: (e) => { toast.error(friendly(e, e.message || "Unable to update this purchase order.")); setConfirm(null); },
  });

  const unitFor = (id) => materials?.find((m) => m.id === id)?.unit || "";

  return (
    <>
      <CrudPage
        table="purchase_orders"
        module="orders"
        title="Purchase Orders"
        subtitle="Request → Approve → Order → Receive → Bill → Payment. Receiving posts stock and the project expense automatically."
        searchKeys={["po_no", "bill_number", "notes"]}
        order={{ column: "created_at", ascending: false }}
        addLabel="New Request"
        fields={[
          { name: "project_id", label: "Project", lookup: { table: "projects" }, required: true },
          { name: "supplier_id", label: "Business / Supplier", lookup: { table: "suppliers", label: "business_name" } },
          { name: "material_id", label: "Material", lookup: { table: "materials", creatable: true }, newPlaceholder: "New custom material name", required: true },
          { name: "work_category_id", label: "Work Category", lookup: { table: "work_categories", creatable: true }, newPlaceholder: "New work category name" },
          { name: "quantity", label: "Quantity", type: "number", required: true, min: 0.001 },
          { name: "unit", label: "Unit", type: "select", options: UNITS },
          { name: "rate", label: "Rate (₹)", type: "number", required: true, default: 0 },
          { name: "transport_cost", label: "Transport Cost (₹)", type: "number", default: 0 },
          { name: "order_date", label: "Order Date", type: "date", default: today, required: true },
          { name: "delivery_date", label: "Expected Delivery", type: "date" },
          { name: "bill_number", label: "Bill Number" },
          { name: "status", label: "Status", type: "select", options: Object.keys(NEXT).concat(["paid", "cancelled"]), default: "requested" },
          { name: "notes", label: "Notes", type: "textarea", full: true },
        ]}
        buildPayload={(v) => {
          const c = clean(v, { numbers: ["quantity", "rate", "transport_cost"] });
          return { ...c, unit: c.unit || unitFor(c.material_id) };
        }}
        detail={(r) => ({
          title: "Purchase Order",
          amount: r.total,
          rows: [
            { label: "Status", text: titleCase(r.status) },
            { label: "Material", text: materials?.find((m) => m.id === r.material_id)?.name },
            { label: "Quantity", text: `${num(r.quantity, 3)} ${r.unit || ""}` },
            { label: "Rate", text: money(r.rate) },
            { label: "Transport", text: money(r.transport_cost) },
            { label: "Order Date", text: fmtDate(r.order_date) },
            { label: "Expected Delivery", text: fmtDate(r.delivery_date) },
            { label: "Received", text: r.received_date ? `${num(r.received_quantity, 3)} on ${fmtDate(r.received_date)}` : "Not received" },
            { label: "Bill Number", text: r.bill_number },
            { label: "Paid", text: money(r.paid_amount) },
          ],
        })}
        columns={[
          { key: "po_no", label: "PO", render: (r) => <span className="mono text-xs text-primary">{r.po_no}</span> },
          { key: "material_id", label: "Material", render: (r) => materials?.find((m) => m.id === r.material_id)?.name || "—" },
          { key: "quantity", label: "Qty", render: (r) => `${num(r.quantity, 3)} ${r.unit || ""}` },
          { key: "total", label: "Total", render: (r) => <span className="mono">{money(r.total)}</span> },
          { key: "delivery_date", label: "Delivery", render: (r) => fmtDate(r.delivery_date) },
          { key: "status", label: "Stage", render: (r) => (
            <span className={`rounded-full px-2 py-0.5 text-[11px] capitalize ${TONE[r.status] || ""}`}>{titleCase(r.status)}</span>
          ) },
        ]}
        rowExtra={(r) => {
          const to = NEXT[r.status];
          if (!writable || !to || r.archived_at) return null;
          if (to === "approved" && !["owner", "manager"].includes(role)) return null;
          return (
            <Button size="sm" variant="secondary" data-testid={`advance-${r.id}`} onClick={() => setConfirm({ row: r, to })}>
              {to === "received" ? <PackageCheck className="mr-1 h-3.5 w-3.5" /> : <ArrowRight className="mr-1 h-3.5 w-3.5" />}
              {titleCase(to)}
            </Button>
          );
        }}
      />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent data-testid="po-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Move to {titleCase(confirm?.to)}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.to === "received"
                ? "This records the material as received: stock is increased and a material expense is posted to the project in one atomic operation."
                : confirm?.to === "paid"
                ? "This marks the full order amount as paid to the business."
                : `The purchase order ${confirm?.row?.po_no} will move to the ${confirm?.to} stage.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="po-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="po-confirm-ok" onClick={() => advance.mutate(confirm)} disabled={advance.isPending}>
              {advance.isPending ? "Working…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
