import React from "react";
import { Link } from "react-router-dom";
import { CrudPage } from "@/components/Crud";
import { clean } from "@/lib/clean";
import { money, fmtDate, PROJECT_STATUS } from "@/lib/fmt";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const fields = [
  { name: "name", label: "Project Name", required: true, full: true },
  { name: "client_name", label: "Client" },
  { name: "contract_amount", label: "Contract Amount (₹)", type: "number", required: true, min: 0 },
  { name: "start_date", label: "Start Date", type: "date" },
  { name: "expected_completion", label: "Expected Completion", type: "date" },
  { name: "actual_completion", label: "Actual Completion", type: "date" },
  { name: "location", label: "Location" },
  { name: "status", label: "Status", type: "select", options: PROJECT_STATUS, default: "planning" },
  { name: "progress", label: "Progress %", type: "number", step: "1", default: 0 },
  { name: "opening_cash", label: "Opening Cash (₹)", type: "number", default: 0 },
  { name: "description", label: "Description", type: "textarea", full: true },
];

export default function Projects() {
  return (
    <CrudPage
      table="projects"
      module="projects"
      title="Projects"
      subtitle="Contracts, progress and financial position of every site"
      searchKeys={["name", "code", "client_name", "location"]}
      order={{ column: "created_at", ascending: false }}
      fields={fields}
      buildPayload={(v) => clean(v, { numbers: ["contract_amount", "progress", "opening_cash"] })}
      columns={[
        { key: "code", label: "Code", render: (r) => <span className="mono text-xs text-primary">{r.code}</span> },
        { key: "name", label: "Project", render: (r) => (
          <Link to={`/projects/${r.id}`} className="font-medium hover:text-primary" data-testid={`open-project-${r.id}`}>{r.name}</Link>
        ) },
        { key: "client_name", label: "Client", render: (r) => r.client_name || "—" },
        { key: "contract_amount", label: "Contract", render: (r) => <span className="mono">{money(r.contract_amount)}</span> },
        { key: "status", label: "Status", render: (r) => <span className="capitalize">{String(r.status).replace("_", " ")}{r.archived_at ? " · archived" : ""}</span> },
        { key: "progress", label: "Progress", render: (r) => `${r.progress}%` },
        { key: "start_date", label: "Start", render: (r) => fmtDate(r.start_date) },
      ]}
      rowExtra={(r) => (
        <Button asChild size="icon" variant="ghost" data-testid={`view-project-${r.id}`}>
          <Link to={`/projects/${r.id}`}><ExternalLink className="h-4 w-4" /></Link>
        </Button>
      )}
    />
  );
}
