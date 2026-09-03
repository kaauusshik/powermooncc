import React from "react";
import { CrudPage } from "@/components/Crud";
import { clean } from "@/lib/clean";
import { money, fmtDate, today, PAYMENT_METHODS } from "@/lib/fmt";

export default function WorkerPayments() {
  return (
    <CrudPage
      table="worker_payments"
      module="payments"
      title="Worker Payments"
      subtitle="Payments, advances and deductions — posted atomically to the project ledger"
      searchKeys={["ref_no", "reference", "notes"]}
      order={{ column: "date", ascending: false }}
      addLabel="Add Payment"
      rpc="record_worker_payment"
      fields={[
        { name: "worker_id", label: "Worker", lookup: { table: "workers" }, required: true },
        { name: "project_id", label: "Project", lookup: { table: "projects" }, required: true },
        { name: "amount", label: "Amount (₹)", type: "number", required: true, min: 0.01 },
        { name: "date", label: "Date", type: "date", required: true, default: today },
        { name: "payment_method", label: "Payment Method", type: "select", options: PAYMENT_METHODS, default: "cash" },
        { name: "kind", label: "Type", type: "select", options: ["payment", "advance", "deduction"], default: "payment" },
        { name: "reference", label: "Reference" },
        { name: "notes", label: "Notes", type: "textarea", full: true },
      ]}
      buildPayload={(v, editing) => {
        const c = clean(v, { numbers: ["amount"] });
        if (editing) return c;
        return {
          p_worker_id: c.worker_id, p_project_id: c.project_id, p_amount: c.amount, p_date: c.date,
          p_method: c.payment_method, p_kind: c.kind, p_reference: c.reference, p_notes: c.notes,
        };
      }}
      columns={[
        { key: "ref_no", label: "Ref", render: (r) => <span className="mono text-xs text-primary">{r.ref_no}</span> },
        { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
        { key: "kind", label: "Type", render: (r) => <span className="capitalize">{r.kind}</span> },
        { key: "amount", label: "Amount", render: (r) => <span className="mono">{money(r.amount)}</span> },
        { key: "payment_method", label: "Method", render: (r) => <span className="capitalize">{String(r.payment_method).replace("_", " ")}</span> },
        { key: "reference", label: "Reference", render: (r) => r.reference || "—" },
      ]}
    />
  );
}
