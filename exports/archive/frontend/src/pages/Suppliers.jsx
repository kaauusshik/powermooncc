import React from "react";
import { CrudPage } from "@/components/Crud";
import { clean } from "@/lib/clean";
import { money, fmtDate } from "@/lib/fmt";
import { useFinance, supplierStats } from "@/lib/finance";

export default function Suppliers() {
  const { data } = useFinance();
  const st = (id) => (data ? supplierStats(data, id) : { total: 0, paid: 0, due: 0, last: null });
  return (
    <CrudPage
      table="suppliers"
      module="suppliers"
      title="Businesses"
      subtitle="Suppliers and businesses — purchases, payments and outstanding dues"
      searchKeys={["business_name", "contact_person", "phone", "gst"]}
      order={{ column: "business_name", ascending: true }}
      addLabel="Add Business"
      detail={(r) => {
        const s = st(r.id);
        return {
          title: "Business Detail",
          amount: s.total,
          rows: [
            { label: "Business Name", text: r.business_name },
            { label: "Contact Person", text: r.contact_person },
            { label: "Phone", text: r.phone },
            { label: "GST", text: r.gst },
            { label: "Category", text: r.category },
            { label: "Address", text: r.address },
            { label: "Total Purchases", text: money(s.total) },
            { label: "Total Paid", text: money(s.paid) },
            { label: "Amount Due", text: money(s.due) },
            { label: "Purchase Count", text: String(s.count || 0) },
            { label: "Last Purchase", text: fmtDate(s.last) },
          ],
        };
      }}
      fields={[
        { name: "business_name", label: "Business Name", required: true, full: true },
        { name: "contact_person", label: "Contact Person" },
        { name: "phone", label: "Phone" },
        { name: "gst", label: "GST" },
        { name: "category", label: "Category" },
        { name: "address", label: "Address", type: "textarea", full: true },
        { name: "notes", label: "Notes", type: "textarea", full: true },
      ]}
      buildPayload={(v) => clean(v)}
      columns={[
        { key: "business_name", label: "Business Name", render: (r) => (
          <div><p className="font-medium">{r.business_name}</p><p className="text-xs text-muted-foreground">{r.contact_person || "—"} · {r.phone || "—"}</p></div>
        ) },
        { key: "category", label: "Category", render: (r) => r.category || "—" },
        { key: "total", label: "Total Purchases", render: (r) => <span className="mono">{money(st(r.id).total)}</span> },
        { key: "paid", label: "Paid", render: (r) => <span className="mono text-accent">{money(st(r.id).paid)}</span> },
        { key: "due", label: "Amount Due", render: (r) => <span className="mono text-primary">{money(st(r.id).due)}</span> },
        { key: "last", label: "Last Purchase", render: (r) => fmtDate(st(r.id).last) },
      ]}
    />
  );
}
