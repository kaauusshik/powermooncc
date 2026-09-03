import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, friendly } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useRows, DataTable, RecordForm, NativeSelect } from "@/components/Crud";
import { BRAND, WORKER_TYPES, PAYMENT_METHODS, EXPENSE_CATEGORIES } from "@/lib/fmt";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Users, Tags, Info } from "lucide-react";

const ROLES = ["owner", "manager", "accountant", "site_staff"];

const UsersTab = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { data: users, isLoading } = useRows("profiles", { order: { column: "created_at", ascending: true } });
  const { data: projects } = useRows("projects", { order: { column: "name", ascending: true } });
  const { data: members } = useRows("project_members", { order: { column: "created_at", ascending: true } });
  const [assign, setAssign] = useState(null);

  const update = useMutation({
    mutationFn: async ({ id, patch, old }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "permission change", table_name: "profiles", record_id: id,
        user_name: profile?.full_name, old_value: old, new_value: patch,
      });
    },
    onSuccess: () => { toast.success("User updated."); qc.invalidateQueries(); },
    onError: (e) => toast.error(friendly(e, "Unable to update user.")),
  });

  const addMember = useMutation({
    mutationFn: async (v) => {
      const { error } = await supabase.from("project_members").insert({
        project_id: v.project_id, user_id: assign.id, role: v.role,
        can_view: true, can_add: v.can_add === "" ? true : !!v.can_add,
        can_edit: !!v.can_edit, can_delete: !!v.can_delete,
        financial_access: !!v.financial_access, report_access: v.report_access === "" ? true : !!v.report_access,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Project access granted."); setAssign(null); qc.invalidateQueries(); },
    onError: (e) => toast.error(friendly(e, "Unable to assign project.")),
  });

  const memberCount = (uid) => (members || []).filter((m) => m.user_id === uid).length;

  return (
    <>
      <DataTable
        testId="users-table"
        loading={isLoading}
        rows={users || []}
        empty="No users yet"
        columns={[
          { key: "full_name", label: "User", render: (r) => (
            <div><p className="font-medium">{r.full_name || "—"}</p><p className="text-xs text-muted-foreground">{r.email} · {r.phone || "—"}</p></div>
          ) },
          { key: "role", label: "Role", render: (r) => (
            <div className="w-40">
              <NativeSelect testId={`role-${r.id}`} value={r.role} options={ROLES.map((x) => ({ value: x, label: x.replace("_", " ") }))}
                onChange={(v) => update.mutate({ id: r.id, patch: { role: v }, old: { role: r.role } })} />
            </div>
          ) },
          { key: "projects", label: "Projects", render: (r) => `${memberCount(r.id)} assigned` },
          { key: "is_active", label: "Active", render: (r) => (
            <Switch data-testid={`active-${r.id}`} checked={r.is_active}
              onCheckedChange={(v) => update.mutate({ id: r.id, patch: { is_active: v }, old: { is_active: r.is_active } })} />
          ) },
        ]}
        actions={(r) => (
          <Button size="sm" variant="secondary" data-testid={`assign-${r.id}`} onClick={() => setAssign(r)}>Assign project</Button>
        )}
      />
      <RecordForm
        open={!!assign} onOpenChange={(o) => !o && setAssign(null)}
        title={`Project access — ${assign?.full_name || ""}`} submitting={addMember.isPending}
        onSubmit={(v) => addMember.mutate(v)}
        fields={[
          { name: "project_id", label: "Project", lookup: { table: "projects" }, required: true },
          { name: "role", label: "Project Role", type: "select", options: ROLES, default: "site_staff", required: true },
          { name: "can_add", label: "Can Add", type: "switch", default: true },
          { name: "can_edit", label: "Can Edit", type: "switch", default: false },
          { name: "can_delete", label: "Can Delete", type: "switch", default: false },
          { name: "financial_access", label: "Financial Access", type: "switch", default: false },
          { name: "report_access", label: "Report Access", type: "switch", default: true },
        ]}
      />
      {projects?.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Create a project first to assign project-level access.</p>}
    </>
  );
};

const MasterList = ({ table, label, field = "name", module = "settings" }) => {
  const qc = useQueryClient();
  const { can, canDelete } = useAuth();
  const { data, isLoading } = useRows(table, { order: { column: field, ascending: true } });
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: async (v) => {
      const { error } = await supabase.from(table).insert({ [field]: v[field] });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(`${label} added.`); setOpen(false); qc.invalidateQueries(); },
    onError: (e) => toast.error(friendly(e, `Unable to add ${label.toLowerCase()}.`)),
  });

  const remove = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed."); qc.invalidateQueries(); },
    onError: (e) => toast.error(friendly(e, "Unable to remove. It may be in use by existing records.")),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="label-xs">{label}</p>
        {can(module, "w") && (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)} data-testid={`add-${table}-btn`}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        )}
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="flex flex-wrap gap-2">
          {(data || []).map((r) => (
            <span key={r.id} data-testid={`${table}-${r.id}`} className="flex items-center gap-2 rounded-full border border-border/70 bg-secondary/50 px-3 py-1.5 text-sm">
              {r[field]}
              {canDelete() && (
                <button className="text-muted-foreground hover:text-destructive" data-testid={`del-${table}-${r.id}`} onClick={() => remove.mutate(r.id)}>×</button>
              )}
            </span>
          ))}
          {(data || []).length === 0 && <p className="text-sm text-muted-foreground">Nothing configured yet.</p>}
        </div>
      )}
      <RecordForm open={open} onOpenChange={setOpen} title={`New ${label}`} submitting={create.isPending}
        onSubmit={(v) => create.mutate(v)} fields={[{ name: field, label, required: true, full: true }]} />
    </div>
  );
};

export default function Settings() {
  const { profile, role } = useAuth();
  return (
    <div className="space-y-5 fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Settings & Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">{BRAND.name} · {BRAND.by} — roles, project access and master data</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users" data-testid="tab-users"><Users className="mr-1.5 h-4 w-4" /> Users</TabsTrigger>
          <TabsTrigger value="master" data-testid="tab-master"><Tags className="mr-1.5 h-4 w-4" /> Master Data</TabsTrigger>
          <TabsTrigger value="business" data-testid="tab-business"><Info className="mr-1.5 h-4 w-4" /> Business</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          {role === "owner" ? <UsersTab /> : (
            <div className="panel p-8 text-center"><p className="font-display">Permission denied</p><p className="mt-1 text-sm text-muted-foreground">Only the Owner can manage users and permissions.</p></div>
          )}
        </TabsContent>

        <TabsContent value="master" className="mt-4 space-y-6">
          <div className="panel space-y-6 p-4">
            <MasterList table="work_categories" label="Work Categories" />
            <MasterList table="material_categories" label="Material Categories" />
            <MasterList table="clients" label="Clients" />
          </div>
          <div className="panel space-y-4 p-4">
            <div><p className="label-xs mb-2">Expense Categories (system)</p>
              <div className="flex flex-wrap gap-2">{EXPENSE_CATEGORIES.map((c) => <span key={c} className="rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-sm capitalize">{c}</span>)}</div>
            </div>
            <div><p className="label-xs mb-2">Worker Types (system)</p>
              <div className="flex flex-wrap gap-2">{WORKER_TYPES.map((c) => <span key={c} className="rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-sm">{c}</span>)}</div>
            </div>
            <div><p className="label-xs mb-2">Payment Methods (system)</p>
              <div className="flex flex-wrap gap-2">{PAYMENT_METHODS.map((c) => <span key={c} className="rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-sm capitalize">{String(c).replace("_", " ")}</span>)}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="business" className="mt-4">
          <div className="panel space-y-3 p-6">
            <div><p className="label-xs">Business Name</p><p className="font-display text-lg">{BRAND.name}</p></div>
            <div><p className="label-xs">Brand</p><p>{BRAND.by}</p></div>
            <div><p className="label-xs">Currency</p><p>₹ INR</p></div>
            <div><p className="label-xs">Date Format</p><p>DD MMM YYYY</p></div>
            <div><p className="label-xs">Signed in as</p><p>{profile?.full_name} · {profile?.email} · <span className="capitalize text-primary">{String(role || "").replace("_", " ")}</span></p></div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
