import React from "react";
import { CrudPage } from "@/components/Crud";
import { clean } from "@/lib/clean";
import { money, fmtDate, today, titleCase, DEDUCTION_KINDS } from "@/lib/fmt";

export default function Deductions() {
  return (
    <CrudPage
      table="deductions"
      module="deductions"
      title="Deductions"
      subtitle="Advance adjustments, damages, penalties and client deductions per project"
      searchKeys={["description", "notes"]}
      order={{ column: "date", ascending: false }}
      addLabel="Add Deduction"
      fields={[
        { name: "project_id", label: "Project", lookup: { table: "projects" }, required: true },
        { name: "date", label: "Date", type: "date", required: true, default: today },
        { name: "kind", label: "Deduction Type", type: "select", options: DEDUCTION_KINDS, required: true, default: "other" },
        { name: "amount", label: "Amount (₹)", type: "number", required: true, min: 0.01 },
        { name: "worker_id", label: "Worker", lookup: { table: "workers" } },
        { name: "supplier_id", label: "Business / Supplier", lookup: { table: "suppliers", label: "business_name" } },
        { name: "description", label: "Description", full: true },
        { name: "notes", label: "Notes", type: "textarea", full: true },
      ]}
      buildPayload={(v) => clean(v, { numbers: ["amount"] })}
      columns={[
        { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
        { key: "kind", label: "Type", render: (r) => titleCase(r.kind) },
        { key: "description", label: "Description", render: (r) => r.description || "—" },
        { key: "amount", label: "Amount", render: (r) => <span className="mono text-primary">{money(r.amount)}</span> },
      ]}
    />
  );
}
