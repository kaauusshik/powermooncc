import React from "react";
import { CrudPage } from "@/components/Crud";
import { clean } from "@/lib/clean";
import { money, fmtDate, today, titleCase, PAYMENT_METHODS } from "@/lib/fmt";

export default function Income() {
  return (
    <CrudPage
      table="incomes"
      module="incomes"
      title="Income"
      subtitle="Client payments and every rupee entering the project"
      detail={(r) => ({
        title: "Income Detail",
        amount: r.amount,
        receipt: r.receipt_url,
        rows: [
          { label: "Received From", text: r.received_from },
          { label: "Purpose", text: r.purpose },
          { label: "Payment Method", text: titleCase(r.payment_method) },
          { label: "Reference", text: r.reference },
        ],
      })}
      searchKeys={["ref_no", "received_from", "purpose", "reference"]}
      order={{ column: "date", ascending: false }}
      addLabel="Add Income"
      fields={[
        { name: "project_id", label: "Project", lookup: { table: "projects" }, required: true },
        { name: "date", label: "Date", type: "date", required: true, default: today },
        { name: "amount", label: "Amount (₹)", type: "number", required: true, min: 0.01 },
        { name: "payment_method", label: "Payment Method", type: "select", options: PAYMENT_METHODS, default: "cash" },
        { name: "received_from", label: "Received From" },
        { name: "purpose", label: "Purpose" },
        { name: "reference", label: "Reference / UTR" },
        { name: "receipt_url", label: "Receipt / Payment Screenshot", type: "file", folder: "receipts", full: true },
        { name: "notes", label: "Notes", type: "textarea", full: true },
      ]}
      buildPayload={(v) => clean(v, { numbers: ["amount"] })}
      columns={[
        { key: "ref_no", label: "Ref", render: (r) => <span className="mono text-xs text-primary">{r.ref_no}</span> },
        { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
        { key: "received_from", label: "Received From", render: (r) => r.received_from || "—" },
        { key: "purpose", label: "Purpose", render: (r) => r.purpose || "—" },
        { key: "amount", label: "Amount", render: (r) => <span className="mono text-accent">{money(r.amount)}</span> },
        { key: "payment_method", label: "Method", render: (r) => <span className="capitalize">{String(r.payment_method).replace("_", " ")}</span> },
      ]}
    />
  );
}
