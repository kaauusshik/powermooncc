import React from "react";
import { CrudPage } from "@/components/Crud";
import { clean } from "@/lib/clean";
import { money, num, UNITS } from "@/lib/fmt";
import { useFinance, materialStock } from "@/lib/finance";

export default function Materials() {
  const { data } = useFinance();
  const st = (id) => (data ? materialStock(data, id) : { remaining: 0, low: false, purchased: 0, used: 0, opening: 0 });
  return (
    <CrudPage
      table="materials"
      module="materials"
      title="Materials"
      subtitle="Default and custom materials, rates, stock levels and low-stock alerts"
      searchKeys={["name", "category", "unit"]}
      order={{ column: "name", ascending: true }}
      addLabel="Add Material"
      detail={(r) => {
        const s = st(r.id);
        return {
          title: "Material Detail",
          amount: r.default_rate,
          rows: [
            { label: "Material", text: r.name },
            { label: "Type", text: r.is_custom ? "Custom material" : "Default material" },
            { label: "Category", text: r.category },
            { label: "Unit", text: r.unit },
            { label: "Default Rate", text: money(r.default_rate) },
            { label: "Minimum Stock", text: `${num(r.min_stock, 3)} ${r.unit}` },
            { label: "Opening Stock", text: `${num(s.opening, 3)} ${r.unit}` },
            { label: "Purchased", text: `${num(s.purchased, 3)} ${r.unit}` },
            { label: "Used", text: `${num(s.used, 3)} ${r.unit}` },
            { label: "Adjusted", text: `${num(s.adjusted, 3)} ${r.unit}` },
            { label: "Remaining", text: `${num(s.remaining, 3)} ${r.unit}${s.low ? " · LOW STOCK" : ""}` },
            { label: "Status", text: r.status },
            { label: "Description", text: r.description },
          ],
        };
      }}
      fields={[
        { name: "name", label: "Material Name", required: true },
        { name: "category", label: "Material Category", lookup: { table: "material_categories", byLabel: true, creatable: true }, newPlaceholder: "New material category", placeholder: "Select category…" },
        { name: "unit", label: "Unit", type: "select", options: UNITS, required: true, default: "nos" },
        { name: "default_rate", label: "Default Rate (₹)", type: "number", default: 0 },
        { name: "supplier_id", label: "Business / Supplier", lookup: { table: "suppliers", label: "business_name" } },
        { name: "min_stock", label: "Minimum Stock Level", type: "number", default: 0 },
        { name: "opening_stock", label: "Opening Stock", type: "number", default: 0 },
        { name: "status", label: "Status", type: "select", options: ["active", "inactive"], default: "active" },
        { name: "description", label: "Description", type: "textarea", full: true },
      ]}
      buildPayload={(v) => {
        const c = clean(v, { numbers: ["default_rate", "min_stock", "opening_stock"] });
        // category lookup returns the category id; store its readable name instead
        return { ...c, category: v.category || null };
      }}
      columns={[
        { key: "name", label: "Material", render: (r) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{r.name}</span>
            {r.is_custom && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">Custom</span>}
            {st(r.id).low && <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive">Low Stock</span>}
          </div>
        ) },
        { key: "unit", label: "Unit" },
        { key: "default_rate", label: "Rate", render: (r) => <span className="mono">{money(r.default_rate)}</span> },
        { key: "purchased", label: "Purchased", render: (r) => num(st(r.id).purchased, 3) },
        { key: "used", label: "Used", render: (r) => num(st(r.id).used, 3) },
        { key: "remaining", label: "Remaining", render: (r) => <span className="mono text-primary">{num(st(r.id).remaining, 3)} {r.unit}</span> },
        { key: "min_stock", label: "Min", render: (r) => num(r.min_stock, 3) },
      ]}
    />
  );
}
