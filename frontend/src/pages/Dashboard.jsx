import React from "react";
import { Link } from "react-router-dom";
import { useFinance, companyStats, budgetAlerts, projectStats } from "@/lib/finance";
import { shortMoney, money, fmtDate, BRAND } from "@/lib/fmt";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown, Wallet, Building2, ArrowRight } from "lucide-react";

const Stat = ({ label, value, sub, tone = "default", testId }) => (
  <div className="panel p-4" data-testid={testId}>
    <p className="label-xs">{label}</p>
    <p className={`stat-value mt-1.5 ${tone === "good" ? "text-accent" : tone === "bad" ? "text-destructive" : tone === "primary" ? "text-primary" : ""}`}>{value}</p>
    {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
  </div>
);

const COLORS = ["#f5a524", "#2bb7a3", "#4a9df0", "#e26a4a", "#a06ad4", "#d4b74a", "#6ad4b0", "#8899aa"];

export default function Dashboard() {
  const { data, isLoading, error } = useFinance();

  if (isLoading)
    return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>;
  if (error)
    return <div className="panel p-8 text-center"><p className="font-display text-lg">Unable to load your data</p><p className="mt-1 text-sm text-muted-foreground">Run the Supabase migration, then reload this page.</p></div>;

  const s = companyStats(data);
  const alerts = budgetAlerts(data);
  const catData = Object.entries(s.byCategory).map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v }));
  const projRows = data.projects.filter((p) => !p.archived_at).map((p) => ({ p, st: projectStats(data, p.id) }));
  const recent = [
    ...data.expenses.map((e) => ({ ...e, kind: "Expense" })),
    ...data.incomes.map((e) => ({ ...e, kind: "Income" })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 8);

  return (
    <div className="space-y-6 fade-up" data-testid="dashboard">
      <div>
        <p className="label-xs">{BRAND.by} · Company Overview</p>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Command Centre</h1>
        <p className="mt-1 text-sm text-muted-foreground">{BRAND.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat testId="stat-projects" label="Projects" value={s.projects} sub="Active & ongoing" />
        <Stat testId="stat-contract" label="Contract Value" value={shortMoney(s.contract)} sub={money(s.contract)} tone="primary" />
        <Stat testId="stat-received" label="Received" value={shortMoney(s.received)} tone="good" />
        <Stat testId="stat-expenses" label="Expenses" value={shortMoney(s.expenses)} tone="bad" />
        <Stat testId="stat-outstanding" label="Outstanding" value={shortMoney(s.outstanding)} sub="Due from clients" />
        <Stat testId="stat-cash" label="Cash" value={shortMoney(s.ledgers.cash)} tone={s.ledgers.cash < 0 ? "bad" : "default"} sub={s.ledgers.cash < 0 ? "Cash paid out exceeds cash in — set opening cash or record income" : null} />
        <Stat testId="stat-upi" label="UPI" value={shortMoney(s.ledgers.upi)} tone={s.ledgers.upi < 0 ? "bad" : "default"} sub={s.ledgers.upi < 0 ? "More UPI spent than received" : null} />
        <Stat testId="stat-bank" label="Bank" value={shortMoney(s.ledgers.bank)} tone={s.ledgers.bank < 0 ? "bad" : "default"} sub={s.ledgers.bank < 0 ? "More paid from bank than received" : null} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {catData.length === 0 ? (
          <div className="panel flex min-h-[220px] flex-col items-center justify-center gap-1 p-6 text-center lg:col-span-3" data-testid="charts-empty">
            <p className="font-display">No spend recorded yet</p>
            <p className="text-sm text-muted-foreground">Add your first expense and the breakdown charts will appear here.</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{BRAND.name} · {BRAND.by}</p>
          </div>
        ) : (
          <>
        <div className="panel p-4 lg:col-span-2">
          <p className="label-xs mb-4">Expense breakdown by category</p>
          <div className="h-64">
            <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
              <BarChart data={catData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#8f9aa6", fontSize: 11 }} />
                <YAxis tickFormatter={shortMoney} tick={{ fill: "#8f9aa6", fontSize: 11 }} width={70} />
                <Tooltip formatter={(v) => money(v)} contentStyle={{ background: "#12161b", border: "1px solid #232a33", borderRadius: 12 }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#f5a524" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel p-4">
          <p className="label-xs mb-2">Share of spend</p>
          <div className="h-64">
            <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => money(v)} contentStyle={{ background: "#12161b", border: "1px solid #232a33", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4" data-testid="alerts-panel">
          <p className="label-xs mb-3 flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-primary" /> Smart alerts</p>
          {alerts.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">All clear. No budget, stock or payment alerts.</p> : (
            <ul className="space-y-2">
              {alerts.map((a, i) => (
                <li key={i}>
                  <Link to={a.to} data-testid={`alert-${i}`} className="flex items-center gap-2 rounded-xl bg-secondary/40 px-3 py-2 text-sm transition-colors hover:bg-secondary/70">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${a.level === "critical" ? "bg-destructive" : "bg-primary"}`} />
                    <span className="min-w-0 flex-1 truncate">{a.text}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-4">
          <p className="label-xs mb-3">Recent transactions</p>
          {recent.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p> : (
            <ul className="divide-y divide-border/50">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  {r.kind === "Income" ? <TrendingUp className="h-4 w-4 text-accent" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{r.description || r.purpose || r.received_from || r.kind}</p>
                    <p className="text-xs text-muted-foreground">{r.ref_no} · {fmtDate(r.date)}</p>
                  </div>
                  <span className="mono text-sm">{money(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="panel p-4">
        <p className="label-xs mb-3 flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-primary" /> Projects</p>
        {projRows.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-display">No projects yet</p>
            <Link to="/projects" className="mt-2 inline-block text-sm text-primary" data-testid="dashboard-create-project">Create your first project →</Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {projRows.map(({ p, st }) => (
              <Link key={p.id} to={`/projects/${p.id}`} data-testid={`dash-project-${p.id}`} className="rounded-2xl border border-border/70 bg-secondary/30 p-4 transition-colors hover:border-primary/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold">{p.name}</p>
                    <p className="mono text-xs text-muted-foreground">{p.code}</p>
                  </div>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary">{st.health}/100</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><p className="label-xs">Contract</p><p className="mono">{shortMoney(st.contract)}</p></div>
                  <div><p className="label-xs">Received</p><p className="mono text-accent">{shortMoney(st.received)}</p></div>
                  <div><p className="label-xs">Expenses</p><p className="mono text-destructive">{shortMoney(st.expenses)}</p></div>
                  <div><p className="label-xs">Balance</p><p className="mono">{shortMoney(st.balance)}</p></div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Progress value={p.progress} className="h-1.5" />
                  <span className="text-xs text-muted-foreground">{p.progress}%</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <p className="flex items-center justify-center gap-2 pb-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <Wallet className="h-3.5 w-3.5" /> {BRAND.name} · {BRAND.by}
      </p>
    </div>
  );
}
