import React from "react";
import { CrudPage } from "@/components/Crud";
import { clean } from "@/lib/clean";
import { money, fmtDate, today, titleCase, PAYMENT_METHODS, EXPENSE_CATEGORIES } from "@/lib/fmt";

const fields = [
  { name: "project_id", label: "Project", lookup: { table: "projects" }, required: true },
  { name: "date", label: "Date", type: "date", required: true, default: today },
  { name: "category", label: "Category", lookup: { table: "expense_categories", byLabel: true, creatable: true }, newPlaceholder: "New expense category", placeholder: "Select or create category…", required: true },
  { name: "work_category_id", label: "Work Category", lookup: { table: "work_categories", creatable: true }, newPlaceholder: "New work category name" },
  { name: "amount", label: "Amount (₹)", type: "number", required: true, min: 0.01 },
  { name: "payment_method", label: "Payment Method", type: "select", options: PAYMENT_METHODS, default: "cash" },
  { name: "description", label: "Description", full: true },
  { name: "person_name", label: "Person Name", placeholder: "Contractor, worker, or person name" },
  { name: "paid_to", label: "Paid To" },
  { name: "worker_id", label: "Worker", lookup: { table: "workers" } },
  { name: "supplier_id", label: "Business / Supplier", lookup: { table: "suppliers", label: "business_name" } },
  { name: "material_id", label: "Material", lookup: { table: "materials", creatable: true }, newPlaceholder: "New custom material name" },
  { name: "quantity", label: "Quantity", type: "number" },
  { name: "unit", label: "Unit" },
  { name: "bill_number", label: "Bill Number" },
  { name: "reference_number", label: "Reference Number" },
  { name: "receipt_url", label: "Receipt / Bill Photo", type: "file", folder: "receipts", full: true },
  { name: "notes", label: "Notes", type: "textarea", full: true },
];

export default function Expenses() {
  return (
    <CrudPage
      table="expenses"
      module="expenses"
      title="Expenses"
      detail={(r) => ({
        title: "Expense Detail",
        amount: r.amount,
        receipt: r.receipt_url,
        rows: [
          { label: "Category", text: titleCase(r.category) },
          { label: "Description", text: r.description },
          { label: "Person Name", text: r.person_name },
          { label: "Payment Method", text: titleCase(r.payment_method) },
          { label: "Paid To", text: r.paid_to },
          { label: "Quantity", text: r.quantity ? `${r.quantity} ${r.unit || ""}` : null },
          { label: "Bill Number", text: r.bill_number },
          { label: "Reference", text: r.reference_number },
        ],
      })}
      subtitle="Every rupee leaving the project — labour, material, transport, food, travel and more"
      searchKeys={["ref_no", "description", "person_name", "paid_to", "bill_number"]}
      order={{ column: "date", ascending: false }}
      fields={fields}
      buildPayload={(v) => clean(v, { numbers: ["amount"] })}
      columns={[
        { key: "ref_no", label: "Ref", render: (r) => <span className="mono text-xs text-primary">{r.ref_no}</span> },
        { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
        { key: "category", label: "Category", render: (r) => <span className="capitalize">{r.category}</span> },
        { key: "description", label: "Description", render: (r) => r.description || "—" },
        { key: "amount", label: "Amount", render: (r) => <span className="mono text-destructive">{money(r.amount)}</span> },
        { key: "payment_method", label: "Method", render: (r) => <span className="capitalize">{String(r.payment_method).replace("_", " ")}</span> },
      ]}
    />
  );
}
