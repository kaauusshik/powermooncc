import React, { useMemo, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase, friendly } from "@/lib/supabase";
import { useRows, NativeSelect } from "@/components/Crud";
import { useAuth } from "@/context/AuthContext";
import { money, today, fmtDate } from "@/lib/fmt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CalendarCheck, Copy } from "lucide-react";

const STATUSES = [
  { key: "present", label: "P", days: 1 },
  { key: "half_day", label: "½", days: 0.5 },
  { key: "absent", label: "A", days: 0 },
  { key: "overtime", label: "OT", days: 1 },
];

export default function Attendance() {
  const { can, profile } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState(today());
  const [projectId, setProjectId] = useState("");
  const [draft, setDraft] = useState({});
  const writable = can("attendance", "w");

  const { data: projects } = useRows("projects", { order: { column: "name", ascending: true } });
  const { data: workers } = useRows("workers", { order: { column: "name", ascending: true } });
  const { data: existing } = useRows("worker_attendance", { eq: { date }, order: { column: "created_at", ascending: true } });

  const activeProjects = (projects || []).filter((p) => !p.archived_at);
  const list = useMemo(
    () => (workers || []).filter((w) => !w.archived_at && w.status === "active" && (!projectId || w.project_id === projectId)),
    [workers, projectId]
  );
  const byWorker = useMemo(() => Object.fromEntries((existing || []).map((a) => [a.worker_id, a])), [existing]);

  const rowFor = (w) => {
    const saved = byWorker[w.id];
    const d = draft[w.id] || {};
    const status = d.status ?? saved?.status ?? "present";
    const ot = d.overtime_hours ?? saved?.overtime_hours ?? 0;
    const wage = d.wage ?? saved?.wage ?? w.daily_wage;
    const days = STATUSES.find((s) => s.key === status)?.days ?? 1;
    const otAmount = (Number(wage) / 8) * Number(ot || 0);
    return { status, ot, wage: Number(wage), days, otAmount, payable: Number(wage) * days + otAmount, saved };
  };

  const totalPayable = list.reduce((a, w) => a + rowFor(w).payable, 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Select a project first");
      const rows = list.map((w) => {
        const r = rowFor(w);
        return {
          worker_id: w.id, project_id: projectId, date, status: r.status, days: r.days,
          wage: r.wage, overtime_hours: Number(r.ot || 0), overtime_amount: r.otAmount, payable: r.payable,
        };
      });
      const { error } = await supabase.from("worker_attendance").upsert(rows, { onConflict: "worker_id,date" });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "created", table_name: "worker_attendance", project_id: projectId,
        user_name: profile?.full_name, new_value: { date, workers: rows.length, payable: totalPayable },
      });
    },
    onSuccess: () => { toast.success("Attendance saved successfully."); setDraft({}); qc.invalidateQueries(); },
    onError: (e) => toast.error(friendly(e, "Unable to save attendance. Please check your connection.")),
  });

  const copyPrevious = async () => {
    const prev = new Date(date); prev.setDate(prev.getDate() - 1);
    const { data } = await supabase.from("worker_attendance").select("*").eq("date", prev.toISOString().slice(0, 10));
    if (!data?.length) return toast.error("No attendance found for the previous day.");
    const d = {};
    data.forEach((a) => { d[a.worker_id] = { status: a.status, overtime_hours: a.overtime_hours, wage: a.wage }; });
    setDraft(d);
    toast.success("Previous day copied. Review and save.");
  };

  return (
    <div className="space-y-5 fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">One-tap daily attendance with automatic wage calculation · {fmtDate(date)}</p>
      </div>

      <div className="panel grid gap-3 p-4 sm:grid-cols-3">
        <div>
          <Label className="label-xs mb-1.5 block">Date</Label>
          <Input data-testid="attendance-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setDraft({}); }} className="bg-secondary/50" />
        </div>
        <div>
          <Label className="label-xs mb-1.5 block">Project</Label>
          <NativeSelect testId="attendance-project" value={projectId} onChange={setProjectId}
            options={activeProjects.map((p) => ({ value: p.id, label: p.name }))} placeholder="All projects" />
        </div>
        <div className="flex items-end gap-2">
          <Button variant="secondary" className="flex-1" onClick={copyPrevious} data-testid="copy-previous-btn"><Copy className="mr-1.5 h-4 w-4" /> Copy previous day</Button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="panel py-14 text-center" data-testid="attendance-empty">
          <CalendarCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 font-display">No active workers to mark</p>
          <p className="text-sm text-muted-foreground">Add workers first · POWER MOON CONSTRUCTION by KUSIK</p>
        </div>
      ) : (
        <>
          <div className="panel divide-y divide-border/50" data-testid="attendance-list">
            {list.map((w) => {
              const r = rowFor(w);
              return (
                <div key={w.id} className="flex flex-wrap items-center gap-3 p-3" data-testid={`attendance-row-${w.id}`}>
                  <div className="min-w-[130px] flex-1">
                    <p className="font-medium">{w.name}</p>
                    <p className="text-xs text-muted-foreground">{w.worker_type} · {money(w.daily_wage)}/day{r.saved ? " · saved" : ""}</p>
                  </div>
                  <div className="flex gap-1">
                    {STATUSES.map((s) => (
                      <button key={s.key} disabled={!writable}
                        data-testid={`att-${w.id}-${s.key}`}
                        onClick={() => setDraft((p) => ({ ...p, [w.id]: { ...(p[w.id] || {}), status: s.key } }))}
                        className={`h-9 w-10 rounded-xl border text-xs font-semibold transition-colors ${r.status === s.key ? "border-primary bg-primary/20 text-primary" : "border-border bg-secondary/40 text-muted-foreground"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <Input data-testid={`att-ot-${w.id}`} type="number" inputMode="decimal" value={r.ot} placeholder="OT hrs"
                    onChange={(e) => setDraft((p) => ({ ...p, [w.id]: { ...(p[w.id] || {}), overtime_hours: e.target.value } }))}
                    className="w-24 bg-secondary/50" />
                  <span className="mono w-28 text-right text-sm text-primary" data-testid={`att-payable-${w.id}`}>{money(r.payable)}</span>
                </div>
              );
            })}
          </div>
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="label-xs">Total payable today</p>
              <p className="stat-value text-primary" data-testid="attendance-total">{money(totalPayable)}</p>
            </div>
            {writable && (
              <Button onClick={() => save.mutate()} disabled={save.isPending || !projectId} data-testid="save-attendance-btn" className="rounded-full">
                {save.isPending ? "Saving…" : "Save attendance"}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
