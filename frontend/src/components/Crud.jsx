import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase, friendly, newIdemKey } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileField } from "@/components/FileField";
import { TransactionSheet } from "@/components/TransactionSheet";
import { enqueue, isOfflineError } from "@/lib/offline";
import { Plus, Pencil, Archive, RotateCcw, Trash2, Search, Inbox, Eye } from "lucide-react";

/* ------------------------------------------------------------------ data */
export const isMissingTable = (error) =>
  error?.code === "PGRST205" ||
  error?.status === 404 ||
  /schema cache|does not exist|not found/i.test(error?.message || "");

export const useRows = (table, { select = "*", order, eq, filters, enabled = true } = {}) =>
  useQuery({
    queryKey: [table, select, order, eq, filters],
    enabled,
    retry: (count, err) => !isMissingTable(err) && count < 2,
    queryFn: async () => {
      let q = supabase.from(table).select(select);
      Object.entries(eq || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q = q.eq(k, v); });
      (filters || []).forEach(([op, k, v]) => { q = q[op](k, v); });
      q = q.order(order?.column || "created_at", { ascending: !!order?.ascending });
      const { data, error } = await q.limit(2000);
      if (error) throw error;
      return data || [];
    },
  });

export const useLookup = (table, labelField = "name", { activeOnly = true, byLabel = false } = {}) =>
  useQuery({
    queryKey: ["lookup", table, labelField, activeOnly, byLabel],
    queryFn: async () => {
      let q = supabase.from(table).select(`id,${labelField},archived_at`);
      const { data, error } = await q.order(labelField);
      if (error) throw error;
      return (data || [])
        .filter((r) => (activeOnly ? !r.archived_at : true))
        .map((r) => ({ value: byLabel ? r[labelField] : r.id, label: r[labelField] }));
    },
  });

/* ---------------------------------------------------------------- fields */
const NativeSelect = ({ value, onChange, options, placeholder, testId }) => (
  <select
    data-testid={testId}
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value)}
    className="flex h-10 w-full rounded-xl border border-input bg-secondary/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
  >
    <option value="">{placeholder || "Select…"}</option>
    {(options || []).map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);
export { NativeSelect };

const CreatableLookup = ({ field, value, onChange, options, testId }) => {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const name = text.trim();
    if (!name) return;
    setBusy(true);
    const t = field.lookup.table;
    const lbl = field.lookup.label || "name";
    const { data, error } = await supabase.from(t).insert({ [lbl]: name }).select().maybeSingle();
    setBusy(false);
    if (error) {
      const dup = error.code === "23505" || /duplicate|already exists|unique/i.test(error.message || "");
      if (dup) {
        await qc.invalidateQueries({ queryKey: ["lookup"] });
        const existing = (options || []).find((o) => String(o.label).toLowerCase() === name.toLowerCase());
        if (existing) onChange(existing.value);
        setAdding(false); setText("");
        return toast.error(`"${name}" already exists${existing ? " — selected it for you." : "."}`);
      }
      return toast.error(friendly(error, `Unable to add "${name}".`));
    }
    await qc.invalidateQueries({ queryKey: ["lookup"] });
    onChange(field.lookup.byLabel ? data[lbl] : data.id);
    setAdding(false); setText("");
    toast.success(`"${name}" added.`);
  };

  if (adding)
    return (
      <div className="flex gap-2">
        <Input data-testid={`${testId}-new-input`} autoFocus value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }}
          placeholder={field.newPlaceholder || "Type a new name…"} className="bg-secondary/50" />
        <Button type="button" size="sm" onClick={create} disabled={busy} data-testid={`${testId}-new-save`}>{busy ? "…" : "Add"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setText(""); }} data-testid={`${testId}-new-cancel`}>Cancel</Button>
      </div>
    );

  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <NativeSelect testId={testId} value={value} onChange={onChange} options={options} placeholder={field.placeholder} />
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)} data-testid={`${testId}-new-btn`}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

const FieldInput = ({ field, value, onChange, lookups }) => {
  const tid = `field-${field.name}`;
  if (field.type === "file")
    return <FileField testId={tid} value={value} onChange={onChange} folder={field.folder || "receipts"} />;
  if (field.type === "textarea")
    return <Textarea data-testid={tid} value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} className="bg-secondary/50" />;
  if (field.type === "switch")
    return <Switch data-testid={tid} checked={!!value} onCheckedChange={onChange} />;
  if (field.type === "select" || field.lookup) {
    const opts = field.lookup ? lookups[field.name] || [] : field.options.map((o) => (typeof o === "string" ? { value: o, label: o.replace(/_/g, " ") } : o));
    if (field.lookup?.creatable)
      return <CreatableLookup field={field} value={value} onChange={onChange} options={opts} testId={tid} />;
    return <NativeSelect testId={tid} value={value} onChange={onChange} options={opts} placeholder={field.placeholder} />;
  }
  return (
    <Input
      data-testid={tid}
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      inputMode={field.type === "number" ? "decimal" : undefined}
      step={field.step || (field.type === "number" ? "0.01" : undefined)}
      value={value ?? ""}
      onChange={(e) => onChange(field.type === "number" ? e.target.value : e.target.value)}
      className="bg-secondary/50"
    />
  );
};

export const RecordForm = ({ open, onOpenChange, title, fields, initial, onSubmit, submitting }) => {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const lookupFields = fields.filter((f) => f.lookup);
  const lookupData = {};
  lookupFields.forEach((f) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const q = useLookup(f.lookup.table, f.lookup.label || "name", { activeOnly: f.lookup.activeOnly !== false, byLabel: !!f.lookup.byLabel });
    lookupData[f.name] = q.data || [];
  });

  React.useEffect(() => {
    if (open) {
      const base = {};
      fields.forEach((f) => { base[f.name] = initial?.[f.name] ?? (typeof f.default === "function" ? f.default() : f.default) ?? ""; });
      setValues(base); setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const set = (k, v) => setValues((p) => ({ ...p, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    fields.forEach((f) => {
      if (f.required && (values[f.name] === "" || values[f.name] === undefined || values[f.name] === null)) errs[f.name] = "Required";
      if (f.type === "number" && values[f.name] !== "" && isNaN(Number(values[f.name]))) errs[f.name] = "Enter a valid number";
      if (f.min !== undefined && Number(values[f.name]) < f.min) errs[f.name] = `Must be at least ${f.min}`;
    });
    setErrors(errs);
    if (Object.keys(errs).length) { toast.error("Please fix the highlighted fields."); return; }
    onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="record-form-dialog" className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle className="font-display">{title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.name} className={f.full ? "sm:col-span-2" : ""}>
              <Label className="label-xs mb-1.5 block">{f.label}{f.required && <span className="text-primary"> *</span>}</Label>
              <FieldInput field={f} value={values[f.name]} onChange={(v) => set(f.name, v)} lookups={lookupData} />
              {errors[f.name] && <p className="mt-1 text-xs text-destructive">{errors[f.name]}</p>}
              {f.help && !errors[f.name] && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
            </div>
          ))}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} data-testid="form-cancel-btn">Cancel</Button>
            <Button type="submit" disabled={submitting} data-testid="form-save-btn">
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/* ------------------------------------------------------------- data table */
export const DataTable = ({ columns, rows, loading, actions, empty, testId = "data-table", onRowClick }) => {
  if (loading)
    return <div className="panel p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (!rows?.length)
    return (
      <div className="panel flex flex-col items-center gap-2 py-14 text-center" data-testid={`${testId}-empty`}>
        <Inbox className="h-8 w-8 text-muted-foreground" />
        <p className="font-display text-base">{empty || "Nothing here yet"}</p>
        <p className="text-sm text-muted-foreground">POWER MOON CONSTRUCTION · by KUSIK</p>
      </div>
    );
  return (
    <div className="panel overflow-hidden" data-testid={testId}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-secondary/40">
              {columns.map((c) => <th key={c.key} className="px-4 py-3 text-left label-xs whitespace-nowrap">{c.label}</th>)}
              {actions && <th className="px-4 py-3 text-right label-xs">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || i} className={`table-row-hover border-b border-border/40 last:border-0 ${onRowClick ? "cursor-pointer" : ""}`} data-testid={`row-${r.id || i}`}
                onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle ${c.className || ""}`}>
                    {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                  </td>
                ))}
                {actions && <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>{actions(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const StatusBadge = ({ value }) => (
  <Badge variant="outline" className="border-border/70 bg-secondary/60 capitalize">{String(value || "").replace(/_/g, " ")}</Badge>
);

/* --------------------------------------------------------------- CrudPage */
export const CrudPage = ({
  table, title, subtitle, select = "*", columns, fields, order = { column: "created_at", ascending: false },
  module, searchKeys = ["name"], buildPayload, rpc, extraToolbar, rowExtra, eq, addLabel, detail,
}) => {
  const { can, canDelete, profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [initialOverride, setInitialOverride] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const { data: rows, isLoading, error } = useRows(table, { select, order, eq });
  const writable = can(module, "w");
  const missingTable = !!error && isMissingTable(error);

  // Every module gets a View drawer; pages may override the layout via `detail`.
  const buildDetail = detail || ((r) => ({
    title: `${title.replace(/s$/, "")} Detail`,
    amount: r.amount ?? r.total ?? r.contract_amount ?? r.daily_wage ?? null,
    receipt: r.receipt_url || r.photo_url || null,
    rows: columns
      .filter((c) => !["amount", "total"].includes(c.key))
      .map((c) => ({ label: c.label, text: typeof r[c.key] === "boolean" ? String(r[c.key]) : r[c.key] })),
  }));

  const filtered = useMemo(() => {
    let list = (rows || []).filter((r) => (showArchived ? true : !r.archived_at));
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(s)));
    }
    return list;
  }, [rows, q, showArchived, searchKeys]);

  const save = useMutation({
    mutationFn: async (values) => {
      const payload = buildPayload ? buildPayload(values, editing) : values;
      if (!editing && !navigator.onLine) {
        enqueue({ table, payload, rpc, label: title });
        return { queued: true };
      }
      if (!editing && rpc) {
        const { data, error } = await supabase.rpc(rpc, { ...payload, p_idem_key: newIdemKey() });
        if (error) throw error;
        return data;
      }
      if (editing) {
        const { data, error } = await supabase.from(table).update(payload).eq("id", editing.id).select().maybeSingle();
        if (error) throw error;
        await logAudit({ action: "updated", table, recordId: editing.id, projectId: payload.project_id, oldValue: editing, newValue: data, userName: profile?.full_name });
        return data;
      }
      const { data, error } = await supabase.from(table).insert(payload).select().maybeSingle();
      if (error) throw error;
      await logAudit({ action: "created", table, recordId: data?.id, projectId: payload.project_id, newValue: data, userName: profile?.full_name });
      return data;
    },
    onSuccess: (res) => {
      if (res?.queued) toast.warning("You're offline. Your changes are pending synchronization.");
      else toast.success(editing ? "Changes saved successfully." : "Record saved successfully.");
      setOpen(false); setEditing(null);
      qc.invalidateQueries();
    },
    onError: (e, values) => {
      if (!editing && isOfflineError(e)) {
        enqueue({ table, payload: buildPayload ? buildPayload(values, null) : values, rpc, label: title });
        setOpen(false); setEditing(null);
        return toast.warning("Connection lost. Your changes are pending synchronization.");
      }
      toast.error(friendly(e, `Unable to save ${title.toLowerCase()}. Please check your connection.`));
    },
  });

  const act = useMutation({
    mutationFn: async ({ row, mode }) => {
      if (mode === "delete") {
        const { error } = await supabase.from(table).delete().eq("id", row.id);
        if (error) throw error;
        await logAudit({ action: "deleted", table, recordId: row.id, projectId: row.project_id, oldValue: row, userName: profile?.full_name });
        return;
      }
      const patch = mode === "archive"
        ? { archived_at: new Date().toISOString(), archived_by: profile?.id }
        : { archived_at: null, archived_by: null };
      const { error } = await supabase.from(table).update(patch).eq("id", row.id);
      if (error) throw error;
      await logAudit({ action: mode === "archive" ? "archived" : "restored", table, recordId: row.id, projectId: row.project_id, oldValue: row, newValue: patch, userName: profile?.full_name });
    },
    onSuccess: () => { toast.success("Done."); setConfirm(null); qc.invalidateQueries(); },
    onError: (e) => { toast.error(friendly(e, "Unable to complete this action.")); setConfirm(null); },
  });

  return (
    <div className="space-y-5 fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {writable && (
          <Button onClick={() => { setEditing(null); setInitialOverride(null); setOpen(true); }} data-testid={`add-${module}-btn`} className="rounded-full">
            <Plus className="mr-1.5 h-4 w-4" /> {addLabel || `Add ${title.replace(/s$/, "")}`}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input data-testid={`search-${module}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="bg-secondary/50 pl-9" />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch data-testid={`toggle-archived-${module}`} checked={showArchived} onCheckedChange={setShowArchived} /> Show archived
        </label>
        {extraToolbar}
      </div>

      {missingTable ? (
        <div className="panel space-y-3 p-8 text-center" data-testid={`${module}-needs-migration`}>
          <p className="font-display text-lg">Database update needed</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            This module needs the phase-3 tables. Open <span className="mono text-primary">supabase/migration_phase3.sql</span> and run it once in your Supabase SQL editor, then reload this page.
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()} data-testid={`${module}-reload`}>Reload</Button>
        </div>
      ) : (
      <DataTable
        testId={`${module}-table`}
        columns={columns}
        rows={filtered}
        loading={isLoading && !error}
        empty={`No ${title.toLowerCase()} recorded yet`}
        onRowClick={(r) => setDetailRow(r)}
        actions={(row) => (
          <div className="flex items-center justify-end gap-1">
            {rowExtra?.(row)}
            <Button size="icon" variant="ghost" data-testid={`view-${row.id}`} onClick={() => setDetailRow(row)} title="View details">
              <Eye className="h-4 w-4" />
            </Button>
            {writable && !row.archived_at && (
              <Button size="icon" variant="ghost" data-testid={`edit-${row.id}`} onClick={() => { setEditing(row); setInitialOverride(null); setOpen(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {writable && (
              row.archived_at ? (
                <Button size="icon" variant="ghost" data-testid={`restore-${row.id}`} onClick={() => setConfirm({ row, mode: "restore" })}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="icon" variant="ghost" data-testid={`archive-${row.id}`} onClick={() => setConfirm({ row, mode: "archive" })}>
                  <Archive className="h-4 w-4" />
                </Button>
              )
            )}
            {canDelete() && (
              <Button size="icon" variant="ghost" className="text-destructive" data-testid={`delete-${row.id}`} onClick={() => setConfirm({ row, mode: "delete" })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      />
      )}

      <RecordForm
        open={open} onOpenChange={setOpen}
        title={`${editing ? "Edit" : "New"} ${title.replace(/s$/, "")}`}
        fields={fields} initial={editing || initialOverride} submitting={save.isPending}
        onSubmit={(v) => save.mutate(v)}
      />

      {(
        <TransactionSheet
          open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}
          row={detailRow}
          {...(detailRow ? buildDetail(detailRow) : {})}
          canWrite={writable} canArchive={writable}
          onEdit={() => { setEditing(detailRow); setInitialOverride(null); setDetailRow(null); setOpen(true); }}
          onDuplicate={() => {
            const dup = { ...detailRow };
            ["id", "ref_no", "idem_key", "created_at", "updated_at", "archived_at", "archived_by", "created_by"].forEach((k) => delete dup[k]);
            setEditing(null); setInitialOverride(dup); setDetailRow(null); setOpen(true);
            toast.info("Duplicated — review and save.");
          }}
          onArchive={() => { setConfirm({ row: detailRow, mode: "archive" }); setDetailRow(null); }}
        />
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent data-testid="confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {confirm?.mode === "delete" ? "Permanently delete record?" : confirm?.mode === "archive" ? "Archive this record?" : "Restore this record?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.mode === "delete"
                ? "This cannot be undone. Historical financial records linked to it may be affected. Prefer archiving instead."
                : confirm?.mode === "archive"
                ? "Archived records become read-only but stay visible in reports and history."
                : "The record will become active again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-ok" onClick={() => act.mutate(confirm)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
