import React from "react";
import { CrudPage } from "@/components/Crud";
import { clean } from "@/lib/clean";
import { money, fmtDate, today, WORKER_TYPES } from "@/lib/fmt";
import { useFinance, workerStats } from "@/lib/finance";

export default function Workers() {
  const { data } = useFinance();
  const st = (id) => (data ? workerStats(data, id) : { earned: 0, paid: 0, outstanding: 0 });
  return (
    <CrudPage
      table="workers"
      module="workers"
      title="Workers"
      subtitle="Labour profiles, wages, earnings and outstanding dues"
      searchKeys={["name", "phone", "worker_type"]}
      order={{ column: "name", ascending: true }}
      detail={(r) => {
        const s = st(r.id);
        return {
          title: "Worker Detail",
          amount: r.daily_wage,
          receipt: r.photo_url,
          rows: [
            { label: "Name", text: r.name },
            { label: "Phone", text: r.phone },
            { label: "Worker Type", text: r.worker_type },
            { label: "Daily Wage", text: money(r.daily_wage) },
            { label: "Joining Date", text: fmtDate(r.joining_date) },
            { label: "Status", text: r.status },
            { label: "Days Worked", text: String(s.days || 0) },
            { label: "Total Earned", text: money(s.earned) },
            { label: "Total Paid", text: money(s.paid) },
            { label: "Advance", text: money(s.advance) },
            { label: "Deduction", text: money(s.deduction) },
            { label: "Outstanding", text: money(s.outstanding) },
            { label: "Last Payment", text: fmtDate(s.lastPayment) },
          ],
        };
      }}
      fields={[
        { name: "name", label: "Worker Name", required: true },
        { name: "phone", label: "Phone" },
        { name: "worker_type", label: "Worker Type", type: "select", options: WORKER_TYPES, default: "Helper", required: true },
        { name: "daily_wage", label: "Daily Wage (₹)", type: "number", required: true, min: 0 },
        { name: "work_category_id", label: "Work Category", lookup: { table: "work_categories" } },
        { name: "project_id", label: "Assigned Project", lookup: { table: "projects" } },
        { name: "joining_date", label: "Joining Date", type: "date", default: today },
        { name: "status", label: "Status", type: "select", options: ["active", "inactive"], default: "active" },
        { name: "photo_url", label: "Photo URL", full: true },
        { name: "notes", label: "Notes", type: "textarea", full: true },
      ]}
      buildPayload={(v) => clean(v, { numbers: ["daily_wage"] })}
      columns={[
        { key: "name", label: "Worker", render: (r) => (
          <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.phone || "—"}</p></div>
        ) },
        { key: "worker_type", label: "Type" },
        { key: "daily_wage", label: "Daily Wage", render: (r) => <span className="mono">{money(r.daily_wage)}</span> },
        { key: "earned", label: "Earned", render: (r) => <span className="mono">{money(st(r.id).earned)}</span> },
        { key: "paid", label: "Paid", render: (r) => <span className="mono text-accent">{money(st(r.id).paid)}</span> },
        { key: "outstanding", label: "Outstanding", render: (r) => <span className="mono text-primary">{money(st(r.id).outstanding)}</span> },
        { key: "joining_date", label: "Joined", render: (r) => fmtDate(r.joining_date) },
      ]}
    />
  );
}
