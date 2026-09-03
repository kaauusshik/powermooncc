import React, { useMemo, useState } from "react";
import { useRows, DataTable, NativeSelect } from "@/components/Crud";
import { fmtDate, titleCase } from "@/lib/fmt";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

const ACTIONS = ["created", "updated", "archived", "restored", "deleted", "payment"];

export default function AuditLogs() {
  const { data, isLoading } = useRows("audit_logs", { order: { column: "created_at", ascending: false } });
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [detail, setDetail] = useState(null);

  const rows = useMemo(() => (data || []).filter((r) =>
    (!action || r.action === action) &&
    (!q.trim() || `${r.table_name} ${r.action} ${r.user_name || ""}`.toLowerCase().includes(q.toLowerCase()))
  ), [data, q, action]);

  const diff = (o, n) => {
    const keys = [...new Set([...Object.keys(o || {}), ...Object.keys(n || {})])];
    return keys.filter((k) => JSON.stringify(o?.[k]) !== JSON.stringify(n?.[k]));
  };

  return (
    <div className="space-y-5 fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">Immutable history of every create, edit, archive, restore, delete and payment</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input data-testid="audit-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search table, action or user…" className="max-w-xs bg-secondary/50" />
        <div className="w-48"><NativeSelect testId="audit-action" value={action} onChange={setAction} options={ACTIONS.map((a) => ({ value: a, label: titleCase(a) }))} placeholder="All actions" /></div>
      </div>

      <DataTable
        testId="audit-table"
        loading={isLoading}
        rows={rows}
        empty="No audit history yet"
        columns={[
          { key: "created_at", label: "When", render: (r) => <span className="text-xs">{new Date(r.created_at).toLocaleString("en-IN")}</span> },
          { key: "user_name", label: "User", render: (r) => r.user_name || "—" },
          { key: "action", label: "Action", render: (r) => <span className="capitalize">{r.action}</span> },
          { key: "table_name", label: "Table", render: (r) => <span className="mono text-xs">{r.table_name}</span> },
          { key: "record_id", label: "Record", render: (r) => <span className="mono text-xs text-muted-foreground">{String(r.record_id || "—").slice(0, 8)}</span> },
        ]}
        actions={(r) => (
          <Button size="icon" variant="ghost" data-testid={`audit-view-${r.id}`} onClick={() => setDetail(r)}><Eye className="h-4 w-4" /></Button>
        )}
      />

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" data-testid="audit-detail">
          <DialogHeader><DialogTitle className="font-display">{titleCase(detail?.action)} · {detail?.table_name}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">{detail && new Date(detail.created_at).toLocaleString("en-IN")} · {detail?.user_name || "—"}</p>
          {detail?.old_value && detail?.new_value ? (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60"><th className="py-2 text-left label-xs">Field</th><th className="py-2 text-left label-xs">Old</th><th className="py-2 text-left label-xs">New</th></tr></thead>
              <tbody>
                {diff(detail.old_value, detail.new_value).map((k) => (
                  <tr key={k} className="border-b border-border/30">
                    <td className="py-2 pr-3">{k}</td>
                    <td className="py-2 pr-3 text-destructive">{String(detail.old_value?.[k] ?? "—")}</td>
                    <td className="py-2 text-accent">{String(detail.new_value?.[k] ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <pre className="mono max-h-80 overflow-auto rounded-xl bg-secondary/50 p-3 text-xs">
              {JSON.stringify(detail?.new_value || detail?.old_value || {}, null, 2)}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
