import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CrudPage, useRows, RecordForm } from "@/components/Crud";
import { supabase, friendly } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { clean } from "@/lib/clean";
import { money, num, fmtDate, today, UNITS } from "@/lib/fmt";
import { useFinance, materialStock } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";

const adjustFields = [
  { name: "material_id", label: "Material", lookup: { table: "materials" }, required: true },
  { name: "project_id", label: "Project", lookup: { table: "projects" } },
  { name: "movement_type", label: "Movement", type: "select", options: ["usage", "adjustment"], required: true, default: "usage" },
  { name: "quantity", label: "Quantity", type: "number", required: true },
  { name: "date", label: "Date", type: "date", required: true, default: today },
  { name: "reason", label: "Reason", required: true, full: true },
];

const StockPanel = () => {
  const { data } = useFinance();
  if (!data) return null;
  const rows = data.materials.filter((m) => !m.archived_at);
  if (!rows.length) return null;
  return (
    <div className="panel overflow-hidden">
      <p className="label-xs px-4 pt-4">Material stock position</p>
      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[620px] text-sm">
          <thead><tr className="border-b border-border/60">
            {["Material", "Opening", "Purchased", "Used", "Adjusted", "Remaining"].map((h) => <th key={h} className="px-3 py-2 text-left label-xs">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((m) => {
              const s = materialStock(data, m.id);
              return (
                <tr key={m.id} className="border-b border-border/30 last:border-0" data-testid={`stock-${m.id}`}>
                  <td className="px-3 py-2">{m.name} {s.low && <span className="ml-1 rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] text-destructive">LOW STOCK</span>}</td>
                  <td className="px-3 py-2 mono">{num(s.opening, 3)}</td>
                  <td className="px-3 py-2 mono">{num(s.purchased, 3)}</td>
                  <td className="px-3 py-2 mono">{num(s.used, 3)}</td>
                  <td className="px-3 py-2 mono">{num(s.adjusted, 3)}</td>
                  <td className="px-3 py-2 mono text-primary">{num(s.remaining, 3)} {m.unit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function Purchases() {
  const { can, profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: materials } = useRows("materials", { order: { column: "name", ascending: true } });

  const adjust = useMutation({
    mutationFn: async (v) => {
      const payload = clean(v, { numbers: ["quantity"] });
      const qty = payload.movement_type === "usage" ? Math.abs(payload.quantity) : payload.quantity;
      const { error } = await supabase.from("material_stock_movements").insert({ ...payload, quantity: qty });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "created", table_name: "material_stock_movements", project_id: payload.project_id || null,
        user_name: profile?.full_name, new_value: payload,
      });
    },
    onSuccess: () => { toast.success("Stock movement recorded."); setOpen(false); qc.invalidateQueries(); },
    onError: (e) => toast.error(friendly(e, "Unable to record stock movement.")),
  });

  const unitFor = (id) => materials?.find((m) => m.id === id)?.unit || "";

  return (
    <div className="space-y-6">
      <CrudPage
        table="material_purchases"
        module="purchases"
        title="Material Purchases"
        subtitle="Quantity × Rate + Transport = Total · stock and project expense updated atomically"
        searchKeys={["ref_no", "bill_number"]}
        order={{ column: "date", ascending: false }}
        addLabel="Add Purchase"
        rpc="record_material_purchase"
        fields={[
          { name: "supplier_id", label: "Business / Supplier", lookup: { table: "suppliers", label: "business_name" } },
          { name: "material_id", label: "Material", lookup: { table: "materials", creatable: true }, newPlaceholder: "New custom material name", required: true },
          { name: "project_id", label: "Project", lookup: { table: "projects" }, required: true },
          { name: "work_category_id", label: "Work Category", lookup: { table: "work_categories", creatable: true }, newPlaceholder: "New work category name" },
          { name: "quantity", label: "Quantity", type: "number", required: true, min: 0.001 },
          { name: "unit", label: "Unit", type: "select", options: UNITS },
          { name: "rate", label: "Rate (₹)", type: "number", required: true, min: 0 },
          { name: "transport_cost", label: "Transport Cost (₹)", type: "number", default: 0 },
          { name: "date", label: "Date", type: "date", required: true, default: today },
          { name: "bill_number", label: "Bill Number" },
          { name: "payment_status", label: "Payment Status", type: "select", options: ["unpaid", "partial", "paid"], default: "unpaid" },
          { name: "receipt_url", label: "Bill / Receipt Photo", type: "file", folder: "bills", full: true },
          { name: "notes", label: "Notes", type: "textarea", full: true },
        ]}
        buildPayload={(v, editing) => {
          const c = clean(v, { numbers: ["quantity", "rate", "transport_cost"] });
          if (editing) {
            const mc = c.quantity * c.rate;
            return { ...c, material_cost: mc, total: mc + c.transport_cost };
          }
          return {
            p_material_id: c.material_id, p_project_id: c.project_id, p_supplier_id: c.supplier_id,
            p_work_category_id: c.work_category_id, p_quantity: c.quantity,
            p_unit: c.unit || unitFor(c.material_id), p_rate: c.rate, p_transport: c.transport_cost,
            p_date: c.date, p_bill: c.bill_number, p_payment_status: c.payment_status, p_notes: c.notes,
            p_receipt_url: c.receipt_url,
          };
        }}
        columns={[
          { key: "ref_no", label: "PO", render: (r) => <span className="mono text-xs text-primary">{r.ref_no}</span> },
          { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
          { key: "quantity", label: "Qty", render: (r) => `${num(r.quantity, 3)} ${r.unit || ""}` },
          { key: "rate", label: "Rate", render: (r) => <span className="mono">{money(r.rate)}</span> },
          { key: "transport_cost", label: "Transport", render: (r) => <span className="mono">{money(r.transport_cost)}</span> },
          { key: "total", label: "Total", render: (r) => <span className="mono text-destructive">{money(r.total)}</span> },
          { key: "payment_status", label: "Payment", render: (r) => <span className="capitalize">{r.payment_status}</span> },
        ]}
        extraToolbar={can("materials", "w") ? (
          <Button variant="secondary" onClick={() => setOpen(true)} data-testid="stock-adjust-btn">
            <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Stock usage / adjustment
          </Button>
        ) : null}
      />
      <StockPanel />
      <RecordForm open={open} onOpenChange={setOpen} title="Stock Usage / Adjustment"
        fields={adjustFields} submitting={adjust.isPending} onSubmit={(v) => adjust.mutate(v)} />
    </div>
  );
}
