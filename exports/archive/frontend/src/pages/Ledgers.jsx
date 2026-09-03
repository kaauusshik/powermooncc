import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, friendly } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useFinance, ledgerBalances } from "@/lib/finance";
import { useRows, RecordForm, DataTable, NativeSelect } from "@/components/Crud";
import { clean } from "@/lib/clean";
import { money, fmtDate, today, titleCase } from "@/lib/fmt";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRightLeft, Banknote, Smartphone, Landmark } from "lucide-react";

const ACCOUNTS = ["cash", "upi", "bank", "other"];
const ICONS = { cash: Banknote, upi: Smartphone, bank: Landmark, other: ArrowRightLeft };

export default function Ledgers() {
  const { can, profile } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useFinance();
  const [projectId, setProjectId] = useState("");
  const [open, setOpen] = useState(false);
  const { data: transfers } = useRows("ledger_transfers", { order: { column: "date", ascending: false } });
  const { data: projects } = useRows("projects", { order: { column: "name", ascending: true } });

  const create = useMutation({
    mutationFn: async (v) => {
      const c = clean(v, { numbers: ["amount"] });
      if (c.from_account === c.to_account) throw new Error("Choose two different accounts");
      const { error } = await supabase.from("ledger_transfers").insert(c);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "created", table_name: "ledger_transfers", project_id: c.project_id || null,
        user_name: profile?.full_name, new_value: c,
      });
    },
    onSuccess: () => { toast.success("Transfer recorded. Ledgers updated."); setOpen(false); qc.invalidateQueries(); },
    onError: (e) => toast.error(friendly(e, e.message || "Unable to record transfer.")),
  });

  const bal = data ? ledgerBalances(data, projectId || null) : { cash: 0, upi: 0, bank: 0, other: 0 };
  const rows = (transfers || []).filter((t) => !projectId || t.project_id === projectId);

  return (
    <div className="space-y-5 fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Ledgers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cash, UPI and Bank balances · internal transfers never count as income or expense</p>
        </div>
        {can("ledgers", "w") && (
          <Button className="rounded-full" onClick={() => setOpen(true)} data-testid="add-transfer-btn">
            <ArrowRightLeft className="mr-1.5 h-4 w-4" /> New Transfer
          </Button>
        )}
      </div>

      <div className="panel max-w-sm p-4">
        <Label className="label-xs mb-1.5 block">Filter by project</Label>
        <NativeSelect testId="ledger-project-filter" value={projectId} onChange={setProjectId}
          options={(projects || []).map((p) => ({ value: p.id, label: p.name }))} placeholder="All projects (company-wide)" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ACCOUNTS.map((a) => {
          const Icon = ICONS[a];
          return (
            <div key={a} className="panel p-4" data-testid={`ledger-${a}`}>
              <p className="label-xs flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-primary" /> {titleCase(a)}</p>
              <p className={`stat-value mt-1.5 ${bal[a] < 0 ? "text-destructive" : ""}`}>{isLoading ? "…" : money(bal[a])}</p>
            </div>
          );
        })}
      </div>

      <div>
        <p className="label-xs mb-3">Internal transfers</p>
        <DataTable
          testId="transfers-table"
          loading={isLoading}
          rows={rows}
          empty="No internal transfers recorded"
          columns={[
            { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
            { key: "from_account", label: "From", render: (r) => titleCase(r.from_account) },
            { key: "to_account", label: "To", render: (r) => titleCase(r.to_account) },
            { key: "amount", label: "Amount", render: (r) => <span className="mono text-primary">{money(r.amount)}</span> },
            { key: "reference", label: "Reference", render: (r) => r.reference || "—" },
          ]}
        />
      </div>

      <RecordForm
        open={open} onOpenChange={setOpen} title="Internal Transfer" submitting={create.isPending}
        onSubmit={(v) => create.mutate(v)}
        fields={[
          { name: "from_account", label: "From Account", type: "select", options: ACCOUNTS, required: true, default: "cash" },
          { name: "to_account", label: "To Account", type: "select", options: ACCOUNTS, required: true, default: "bank" },
          { name: "amount", label: "Amount (₹)", type: "number", required: true, min: 0.01 },
          { name: "date", label: "Date", type: "date", required: true, default: today },
          { name: "project_id", label: "Project (optional)", lookup: { table: "projects" } },
          { name: "reference", label: "Reference" },
          { name: "notes", label: "Notes", type: "textarea", full: true },
        ]}
      />
    </div>
  );
}
