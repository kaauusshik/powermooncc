import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ledgerBucket } from "@/lib/fmt";

const fetchAll = async () => {
  const [projects, expenses, incomes, deductions, transfers, budgets, workCats, materials, purchases, movements, workers, payments, attendance, suppliers, transportation] =
    await Promise.all([
      supabase.from("projects").select("*"),
      supabase.from("expenses").select("*"),
      supabase.from("incomes").select("*"),
      supabase.from("deductions").select("*"),
      supabase.from("ledger_transfers").select("*"),
      supabase.from("project_budgets").select("*"),
      supabase.from("work_categories").select("*"),
      supabase.from("materials").select("*"),
      supabase.from("material_purchases").select("*"),
      supabase.from("material_stock_movements").select("*"),
      supabase.from("workers").select("*"),
      supabase.from("worker_payments").select("*"),
      supabase.from("worker_attendance").select("*"),
      supabase.from("suppliers").select("*"),
      supabase.from("transportation").select("*"),
    ]);
  const err = [projects, expenses, incomes, workCats].find((r) => r.error);
  if (err) throw err.error;
  const live = (r) => (r.data || []).filter((x) => !x.archived_at);
  return {
    projects: projects.data || [],
    expenses: live(expenses), incomes: live(incomes), deductions: live(deductions),
    transfers: transfers.data || [], budgets: budgets.data || [], workCats: workCats.data || [],
    materials: materials.data || [], purchases: live(purchases), movements: movements.data || [],
    workers: workers.data || [], payments: live(payments), attendance: attendance.data || [],
    suppliers: suppliers.data || [], transportation: live(transportation),
  };
};

export const useFinance = () =>
  useQuery({ queryKey: ["finance"], queryFn: fetchAll, staleTime: 15_000 });

const sum = (arr, f = (x) => x.amount) => arr.reduce((a, b) => a + Number(f(b) || 0), 0);

export const projectStats = (d, projectId) => {
  const p = d.projects.find((x) => x.id === projectId);
  const ex = d.expenses.filter((x) => x.project_id === projectId);
  const inc = d.incomes.filter((x) => x.project_id === projectId);
  const ded = d.deductions.filter((x) => x.project_id === projectId);
  const contract = Number(p?.contract_amount || 0);
  const received = sum(inc);
  const expenses = sum(ex);
  const deductions = sum(ded);
  const balance = received - expenses - deductions;
  const outstanding = contract - received;
  const adjusted = contract - deductions;
  const progress = Number(p?.progress || 0);
  const forecast = progress > 5 ? (expenses / progress) * 100 : expenses;
  return {
    project: p, contract, received, expenses, deductions, balance, outstanding, adjusted,
    estimatedProfit: adjusted - forecast, actualProfit: adjusted - expenses,
    forecastFinalCost: forecast, remainingCost: Math.max(forecast - expenses, 0),
    byCategory: catTotals(ex), byWork: workTotals(ex, d.workCats), count: ex.length + inc.length,
    health: healthScore({ contract, received, expenses, deductions, progress }),
  };
};

export const companyStats = (d) => {
  const active = d.projects.filter((p) => !p.archived_at);
  const contract = sum(active, (p) => p.contract_amount);
  const received = sum(d.incomes);
  const expenses = sum(d.expenses);
  const deductions = sum(d.deductions);
  return {
    projects: active.length, contract, received, expenses, deductions,
    outstanding: contract - received,
    ledgers: ledgerBalances(d),
    estimatedProfit: contract - deductions - expenses,
    byCategory: catTotals(d.expenses),
  };
};

export const ledgerBalances = (d, projectId = null) => {
  const f = (arr) => (projectId ? arr.filter((x) => x.project_id === projectId) : arr);
  const res = { cash: 0, upi: 0, bank: 0, other: 0 };
  f(d.incomes).forEach((i) => { res[ledgerBucket(i.payment_method)] += Number(i.amount || 0); });
  f(d.expenses).forEach((e) => { res[ledgerBucket(e.payment_method)] -= Number(e.amount || 0); });
  f(d.transfers).forEach((t) => {
    if (res[t.from_account] !== undefined) res[t.from_account] -= Number(t.amount || 0);
    if (res[t.to_account] !== undefined) res[t.to_account] += Number(t.amount || 0);
  });
  const opening = projectId
    ? Number(d.projects.find((p) => p.id === projectId)?.opening_cash || 0)
    : sum(d.projects.filter((p) => !p.archived_at), (p) => p.opening_cash);
  res.cash += opening;
  return res;
};

const catTotals = (ex) => {
  const m = {};
  ex.forEach((e) => { m[e.category] = (m[e.category] || 0) + Number(e.amount || 0); });
  return m;
};

const workTotals = (ex, workCats) =>
  workCats.filter((w) => !w.archived_at).map((w) => {
    const rows = ex.filter((e) => e.work_category_id === w.id);
    return {
      ...w, spent: sum(rows), count: rows.length,
      labor: sum(rows.filter((r) => r.category === "labor")),
      materials: sum(rows.filter((r) => r.category === "material")),
      transportation: sum(rows.filter((r) => r.category === "transportation")),
      other: sum(rows.filter((r) => !["labor", "material", "transportation"].includes(r.category))),
    };
  });

export const materialStock = (d, materialId) => {
  const m = d.materials.find((x) => x.id === materialId);
  const mv = d.movements.filter((x) => x.material_id === materialId);
  const purchased = sum(mv.filter((x) => x.movement_type === "purchase"), (x) => x.quantity);
  const used = sum(mv.filter((x) => x.movement_type === "usage"), (x) => x.quantity);
  const adjusted = sum(mv.filter((x) => x.movement_type === "adjustment"), (x) => x.quantity);
  const opening = Number(m?.opening_stock || 0);
  const remaining = opening + purchased - used + adjusted;
  return { opening, purchased, used, adjusted, remaining, low: remaining < Number(m?.min_stock || 0) };
};

export const workerStats = (d, workerId) => {
  const att = d.attendance.filter((a) => a.worker_id === workerId);
  const earned = sum(att, (a) => a.payable);
  const pays = d.payments.filter((p) => p.worker_id === workerId);
  const paid = sum(pays.filter((p) => p.kind === "payment"));
  const advance = sum(pays.filter((p) => p.kind === "advance"));
  const deduction = sum(pays.filter((p) => p.kind === "deduction"));
  return {
    earned, paid, advance, deduction,
    outstanding: earned - paid - advance - deduction,
    days: sum(att, (a) => a.days),
    lastPayment: pays.sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.date || null,
  };
};

export const supplierStats = (d, supplierId) => {
  const rows = d.purchases.filter((p) => p.supplier_id === supplierId);
  const total = sum(rows, (r) => r.total);
  const paid = sum(rows, (r) => r.paid_amount);
  return { total, paid, due: total - paid, last: rows.sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.date || null, count: rows.length };
};

const healthScore = ({ contract, received, expenses, deductions, progress }) => {
  if (!contract) return 0;
  const budgetUse = expenses / contract;
  const collection = received / contract;
  let s = 100;
  s -= Math.max(0, (budgetUse - progress / 100)) * 120;
  s -= Math.max(0, (progress / 100 - collection)) * 60;
  s -= (deductions / contract) * 40;
  return Math.max(0, Math.min(100, Math.round(s)));
};

export const budgetAlerts = (d) => {
  const alerts = [];
  d.budgets.forEach((b) => {
    const ex = d.expenses.filter(
      (e) => e.project_id === b.project_id &&
        (b.work_category_id ? e.work_category_id === b.work_category_id : e.category === b.expense_category)
    );
    const spent = sum(ex);
    const budget = Number(b.budget_amount || 0);
    if (!budget) return;
    const pct = (spent / budget) * 100;
    const proj = d.projects.find((p) => p.id === b.project_id)?.name || "Project";
    const label = b.work_category_id
      ? d.workCats.find((w) => w.id === b.work_category_id)?.name
      : b.expense_category;
    if (pct >= 100) alerts.push({ level: "critical", text: `Budget exceeded — ${proj} · ${label} (${pct.toFixed(0)}%)`, to: `/projects/${b.project_id}` });
    else if (pct >= 90) alerts.push({ level: "critical", text: `Budget nearly exhausted — ${proj} · ${label} (${pct.toFixed(0)}%)`, to: `/projects/${b.project_id}` });
    else if (pct >= 75) alerts.push({ level: "warn", text: `Budget warning — ${proj} · ${label} (${pct.toFixed(0)}%)`, to: `/projects/${b.project_id}` });
  });
  d.materials.filter((m) => !m.archived_at).forEach((m) => {
    const st = materialStock(d, m.id);
    if (Number(m.min_stock) > 0 && st.low)
      alerts.push({ level: "warn", text: `Low stock — ${m.name}: ${st.remaining} ${m.unit} (min ${m.min_stock})`, to: "/materials" });
  });
  d.workers.filter((w) => !w.archived_at).forEach((w) => {
    const st = workerStats(d, w.id);
    if (st.outstanding > 0) alerts.push({ level: "warn", text: `Worker payment pending — ${w.name}: ₹${st.outstanding.toFixed(0)}`, to: "/worker-payments" });
  });
  d.projects.filter((p) => !p.archived_at).forEach((p) => {
    const s = projectStats(d, p.id);
    if (s.contract && s.expenses / s.contract >= 0.9)
      alerts.push({ level: "critical", text: `Contract nearly exhausted — ${p.name}`, to: `/projects/${p.id}` });
  });
  return alerts.slice(0, 25);
};
