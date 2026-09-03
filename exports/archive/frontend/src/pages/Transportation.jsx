import React from "react";
import { CrudPage } from "@/components/Crud";
import { clean } from "@/lib/clean";
import { money, fmtDate, today, PAYMENT_METHODS } from "@/lib/fmt";

export default function Transportation() {
  return (
    <CrudPage
      table="transportation"
      module="transportation"
      title="Transportation"
      subtitle="Trips × Rate + fuel, loading and unloading = total transportation cost"
      searchKeys={["vehicle", "driver", "from_location", "to_location"]}
      order={{ column: "date", ascending: false }}
      addLabel="Add Trip"
      fields={[
        { name: "project_id", label: "Project", lookup: { table: "projects" }, required: true },
        { name: "work_category_id", label: "Work Category", lookup: { table: "work_categories", creatable: true }, newPlaceholder: "New work category name" },
        { name: "material_id", label: "Material", lookup: { table: "materials", creatable: true }, newPlaceholder: "New custom material name" },
        { name: "vehicle", label: "Vehicle", required: true },
        { name: "driver", label: "Driver" },
        { name: "from_location", label: "From" },
        { name: "to_location", label: "To" },
        { name: "quantity", label: "Quantity", type: "number" },
        { name: "trips", label: "Trips", type: "number", step: "1", default: 1, required: true },
        { name: "rate", label: "Rate per trip (₹)", type: "number", required: true, default: 0 },
        { name: "fuel_cost", label: "Fuel (₹)", type: "number", default: 0 },
        { name: "loading_cost", label: "Loading (₹)", type: "number", default: 0 },
        { name: "unloading_cost", label: "Unloading (₹)", type: "number", default: 0 },
        { name: "payment_method", label: "Payment Method", type: "select", options: PAYMENT_METHODS, default: "cash" },
        { name: "date", label: "Date", type: "date", required: true, default: today },
        { name: "notes", label: "Notes", type: "textarea", full: true },
      ]}
      buildPayload={(v) => {
        const c = clean(v, { numbers: ["quantity", "trips", "rate", "fuel_cost", "loading_cost", "unloading_cost"] });
        c.total = c.trips * c.rate + c.fuel_cost + c.loading_cost + c.unloading_cost;
        return c;
      }}
      columns={[
        { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
        { key: "vehicle", label: "Vehicle", render: (r) => (
          <div><p className="font-medium">{r.vehicle}</p><p className="text-xs text-muted-foreground">{r.driver || "—"}</p></div>
        ) },
        { key: "route", label: "Route", render: (r) => `${r.from_location || "—"} → ${r.to_location || "—"}` },
        { key: "trips", label: "Trips" },
        { key: "rate", label: "Rate", render: (r) => <span className="mono">{money(r.rate)}</span> },
        { key: "total", label: "Total", render: (r) => <span className="mono text-destructive">{money(r.total)}</span> },
      ]}
    />
  );
}
