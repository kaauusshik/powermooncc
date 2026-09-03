import React, { useMemo, useState } from "react";
import { useFinance, projectStats, ledgerBalances, workerStats, supplierStats, materialStock } from "@/lib/finance";
import { useAuth } from "@/context/AuthContext";
import { NativeSelect, DataTable } from "@/components/Crud";
import { money, num, fmtDate, dateRangeFor, titleCase, BRAND } from "@/lib/fmt";
import { exportCSV, exportExcel, exportPDF } from "@/lib/exports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";

const REPORTS = [
  "Project Financial", "Work-Wise", "Labor", "Worker Payment", "Material", "Supplier",
  "Transportation", "Income", "Expense", "Cash", "UPI", "Bank", "Profit & Loss",
  "Date-Wise", "Budget Variance", "Project Progress", "Outstanding",
];

const PRESETS = [
  ["all", "All time"], ["today", "Today"], ["yesterday", "Yesterday"], ["week", "This Week"],
  ["month", "This Month"], ["prev_month", "Previous Month"], ["year", "This Year"], ["custom", "Custom Range"],
];

export default function Reports() {
  const { data, isLoading } = useFinance();
  const { profile } = useAuth();
  const [report, setReport] = useState("Project Financial");
  const [projectId, setProjectId] = useState("");
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const range = preset === "custom" ? { from: from || null, to: to || null } : dateRangeFor(preset);

  const built = useMemo(() => {
    if (!data) return { columns: [], rows: [], totals: [] };
    const inRange = (d) => (!range.from || d >= range.from) && (!range.to || d <= range.to);
    const P = (arr) => arr.filter((x) => (!projectId || x.project_id === projectId) && inRange(x.date));
    const pname = (id) => data.projects.find((p) => p.id === id)?.name || "—";
    const wname = (id) => data.workCats.find((w) => w.id === id)?.name || "—";
    const ex = P(data.expenses), inc = P(data.incomes), ded = P(data.deductions);
    const M = (v) => money(v);

    switch (report) {
      case "Work-Wise": {
        const list = data.workCats.filter((w) => !w.archived_at).map((w) => {
          const rows = ex.filter((e) => e.work_category_id === w.id);
          const budget = data.budgets.filter((b) => b.work_category_id === w.id && (!projectId || b.project_id === projectId))
            .reduce((a, b) => a + Number(b.budget_amount || 0), 0);
          const spent = rows.reduce((a, b) => a + Number(b.amount), 0);
          return {
            "Work Category": w.name, Budget: budget, Spent: spent, Remaining: budget - spent,
            "Used %": budget ? ((spent / budget) * 100).toFixed(1) : "—",
            Labor: rows.filter((r) => r.category === "labor").reduce((a, b) => a + Number(b.amount), 0),
            Materials: rows.filter((r) => r.category === "material").reduce((a, b) => a + Number(b.amount), 0),
            Transportation: rows.filter((r) => r.category === "transportation").reduce((a, b) => a + Number(b.amount), 0),
            Transactions: rows.length,
          };
        });
        return { rows: list, columns: Object.keys(list[0] || { "Work Category": "" }).map((k) => ({ key: k, label: k })), totals: [] };
      }
      case "Labor": {
        const list = data.workers.map((w) => {
          const s = workerStats(data, w.id);
          return { Worker: w.name, Type: w.worker_type, "Daily Wage": w.daily_wage, Days: s.days, Earned: s.earned, Paid: s.paid, Advance: s.advance, Outstanding: s.outstanding };
        });
        return { rows: list, columns: Object.keys(list[0] || { Worker: "" }).map((k) => ({ key: k, label: k })), totals: [{ label: "Total Outstanding", value: M(list.reduce((a, b) => a + b.Outstanding, 0)) }] };
      }
      case "Worker Payment": {
        const list = P(data.payments).map((p) => ({
          Ref: p.ref_no, Date: p.date, Worker: data.workers.find((w) => w.id === p.worker_id)?.name || "—",
          Project: pname(p.project_id), Type: p.kind, Amount: p.amount, Method: p.payment_method,
        }));
        return { rows: list, columns: Object.keys(list[0] || { Ref: "" }).map((k) => ({ key: k, label: k })), totals: [{ label: "Total Paid", value: M(list.reduce((a, b) => a + Number(b.Amount), 0)) }] };
      }
      case "Material": {
        const list = data.materials.filter((m) => !m.archived_at).map((m) => {
          const s = materialStock(data, m.id);
          const pur = data.purchases.filter((p) => p.material_id === m.id && (!projectId || p.project_id === projectId) && inRange(p.date));
          return { Material: m.name, Unit: m.unit, Rate: m.default_rate, Opening: s.opening, Purchased: s.purchased, Used: s.used, Remaining: s.remaining, "Purchase Value": pur.reduce((a, b) => a + Number(b.total), 0) };
        });
        return { rows: list, columns: Object.keys(list[0] || { Material: "" }).map((k) => ({ key: k, label: k })), totals: [] };
      }
      case "Supplier": {
        const rows = (data.suppliers || []).map((sp) => {
          const s = supplierStats(data, sp.id);
          return { Business: sp.business_name, Contact: sp.contact_person || "—", Phone: sp.phone || "—", Purchases: s.total, Paid: s.paid, Due: s.due, "Last Purchase": s.last, Count: s.count };
        });
        return { rows, columns: ["Business", "Contact", "Phone", "Purchases", "Paid", "Due", "Last Purchase", "Count"].map((k) => ({ key: k, label: k })), totals: [{ label: "Total Due", value: M(rows.reduce((a, b) => a + b.Due, 0)) }] };
      }
      case "Transportation": {
        const list = P(data.transportation || []).map((t) => ({ Date: t.date, Vehicle: t.vehicle, Driver: t.driver, Trips: t.trips, Rate: t.rate, Total: t.total }));
        return { rows: list, columns: Object.keys(list[0] || { Date: "" }).map((k) => ({ key: k, label: k })), totals: [] };
      }
      case "Income":
        return {
          rows: inc.map((i) => ({ Ref: i.ref_no, Date: i.date, Project: pname(i.project_id), "Received From": i.received_from, Purpose: i.purpose, Method: i.payment_method, Amount: i.amount })),
          columns: ["Ref", "Date", "Project", "Received From", "Purpose", "Method", "Amount"].map((k) => ({ key: k, label: k })),
          totals: [{ label: "Total Received", value: M(inc.reduce((a, b) => a + Number(b.amount), 0)) }],
        };
      case "Expense":
      case "Date-Wise":
        return {
          rows: ex.map((e) => ({ Ref: e.ref_no, Date: e.date, Project: pname(e.project_id), Category: e.category, "Work Category": wname(e.work_category_id), Description: e.description, Method: e.payment_method, Amount: e.amount })),
          columns: ["Ref", "Date", "Project", "Category", "Work Category", "Description", "Method", "Amount"].map((k) => ({ key: k, label: k })),
          totals: [{ label: "Total Expenses", value: M(ex.reduce((a, b) => a + Number(b.amount), 0)) }],
        };
      case "Cash":
      case "UPI":
      case "Bank": {
        const bucket = report.toLowerCase() === "upi" ? "upi" : report.toLowerCase();
        const methods = bucket === "cash" ? ["cash"] : bucket === "upi" ? ["upi"] : ["neft", "bank_transfer", "card", "cheque"];
        const rows = [
          ...inc.filter((i) => methods.includes(i.payment_method)).map((i) => ({ Date: i.date, Type: "Income", Particulars: i.received_from || i.purpose || "Income", Ref: i.ref_no, In: i.amount, Out: 0 })),
          ...ex.filter((e) => methods.includes(e.payment_method)).map((e) => ({ Date: e.date, Type: "Expense", Particulars: e.description || e.category, Ref: e.ref_no, In: 0, Out: e.amount })),
        ].sort((a, b) => (a.Date > b.Date ? 1 : -1));
        const b = ledgerBalances(data, projectId || null);
        return { rows, columns: ["Date", "Type", "Particulars", "Ref", "In", "Out"].map((k) => ({ key: k, label: k })), totals: [{ label: `${report} Balance`, value: M(b[bucket]) }] };
      }
      case "Profit & Loss": {
        const totalEx = ex.reduce((a, b) => a + Number(b.amount), 0);
        const totalIn = inc.reduce((a, b) => a + Number(b.amount), 0);
        const totalDed = ded.reduce((a, b) => a + Number(b.amount), 0);
        const rows = Object.entries(ex.reduce((m, e) => { m[e.category] = (m[e.category] || 0) + Number(e.amount); return m; }, {}))
          .map(([k, v]) => ({ Head: titleCase(k), Type: "Expense", Amount: v }));
        rows.unshift({ Head: "Income Received", Type: "Income", Amount: totalIn });
        rows.push({ Head: "Deductions", Type: "Deduction", Amount: totalDed });
        return { rows, columns: ["Head", "Type", "Amount"].map((k) => ({ key: k, label: k })), totals: [{ label: "Net Profit / Loss", value: M(totalIn - totalEx - totalDed) }] };
      }
      case "Budget Variance": {
        const rows = data.budgets.filter((b) => !projectId || b.project_id === projectId).map((b) => {
          const rel = ex.filter((e) => e.project_id === b.project_id && (b.work_category_id ? e.work_category_id === b.work_category_id : e.category === b.expense_category));
          const spent = rel.reduce((a, x) => a + Number(x.amount), 0);
          return { Project: pname(b.project_id), Head: b.work_category_id ? wname(b.work_category_id) : titleCase(b.expense_category), Budget: b.budget_amount, Spent: spent, Variance: Number(b.budget_amount) - spent, "Used %": b.budget_amount ? ((spent / b.budget_amount) * 100).toFixed(1) : "—" };
        });
        return { rows, columns: ["Project", "Head", "Budget", "Spent", "Variance", "Used %"].map((k) => ({ key: k, label: k })), totals: [] };
      }
      case "Project Progress":
        return {
          rows: data.projects.map((p) => { const s = projectStats(data, p.id); return { Code: p.code, Project: p.name, Status: p.status, "Progress %": p.progress, Contract: s.contract, Expenses: s.expenses, "Health /100": s.health, "Expected Completion": p.expected_completion }; }),
          columns: ["Code", "Project", "Status", "Progress %", "Contract", "Expenses", "Health /100", "Expected Completion"].map((k) => ({ key: k, label: k })), totals: [],
        };
      case "Outstanding":
        return {
          rows: data.projects.map((p) => { const s = projectStats(data, p.id); return { Code: p.code, Project: p.name, Client: p.client_name, Contract: s.contract, Received: s.received, Outstanding: s.outstanding }; }),
          columns: ["Code", "Project", "Client", "Contract", "Received", "Outstanding"].map((k) => ({ key: k, label: k })),
          totals: [{ label: "Total Outstanding", value: M(data.projects.reduce((a, p) => a + projectStats(data, p.id).outstanding, 0)) }],
        };
      default: {
        const list = (projectId ? data.projects.filter((p) => p.id === projectId) : data.projects).map((p) => {
          const s = projectStats(data, p.id);
          return { Code: p.code, Project: p.name, Contract: s.contract, Received: s.received, Expenses: s.expenses, Deductions: s.deductions, Balance: s.balance, Outstanding: s.outstanding, "Estimated Profit": Math.round(s.estimatedProfit), "Actual Profit": Math.round(s.actualProfit) };
        });
        return {
          rows: list, columns: Object.keys(list[0] || { Code: "" }).map((k) => ({ key: k, label: k })),
          totals: [{ label: "Total Contract", value: M(list.reduce((a, b) => a + b.Contract, 0)) }, { label: "Total Expenses", value: M(list.reduce((a, b) => a + b.Expenses, 0)) }],
        };
      }
    }
  }, [data, report, projectId, range.from, range.to]);

  const meta = [
    `Report: ${report}`,
    `Project: ${projectId ? data?.projects.find((p) => p.id === projectId)?.name : "All projects"}`,
    `Period: ${range.from || "Beginning"} to ${range.to || "Today"}`,
    `Report date: ${fmtDate(new Date())}`,
    `Generated by: ${profile?.full_name || "—"}`,
  ];
  const fileName = `PMC-${report.replace(/[^A-Za-z]+/g, "-")}-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="space-y-5 fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">{BRAND.name} · {BRAND.by} — branded PDF, Excel and CSV exports</p>
      </div>

      <div className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="label-xs mb-1.5 block">Report</Label>
          <NativeSelect testId="report-select" value={report} onChange={setReport} options={REPORTS.map((r) => ({ value: r, label: r }))} />
        </div>
        <div>
          <Label className="label-xs mb-1.5 block">Project</Label>
          <NativeSelect testId="report-project" value={projectId} onChange={setProjectId} options={(data?.projects || []).map((p) => ({ value: p.id, label: p.name }))} placeholder="All projects" />
        </div>
        <div>
          <Label className="label-xs mb-1.5 block">Period</Label>
          <NativeSelect testId="report-period" value={preset} onChange={setPreset} options={PRESETS.map(([v, l]) => ({ value: v, label: l }))} />
        </div>
        {preset === "custom" ? (
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="label-xs mb-1.5 block">From</Label><Input data-testid="report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-secondary/50" /></div>
            <div><Label className="label-xs mb-1.5 block">To</Label><Input data-testid="report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-secondary/50" /></div>
          </div>
        ) : <div />}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button data-testid="export-pdf" onClick={() => exportPDF({ filename: fileName, title: `${report} Report`, meta, columns: built.columns, rows: built.rows, totals: built.totals })} disabled={!built.rows.length}>
          <FileText className="mr-1.5 h-4 w-4" /> PDF
        </Button>
        <Button variant="secondary" data-testid="export-excel" onClick={() => exportExcel(fileName, built.rows, report.slice(0, 28))} disabled={!built.rows.length}>
          <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
        </Button>
        <Button variant="secondary" data-testid="export-csv" onClick={() => exportCSV(fileName, built.rows)} disabled={!built.rows.length}>
          <FileDown className="mr-1.5 h-4 w-4" /> CSV
        </Button>
      </div>

      {built.totals.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {built.totals.map((t) => (
            <div key={t.label} className="panel p-4"><p className="label-xs">{t.label}</p><p className="stat-value mt-1.5 text-primary">{t.value}</p></div>
          ))}
        </div>
      )}

      <DataTable
        testId="report-table"
        loading={isLoading}
        rows={built.rows}
        empty="No records for this report and period"
        columns={built.columns.map((c) => ({
          ...c,
          render: (r) => {
            const v = r[c.key];
            if (typeof v === "number" && !["Trips", "Count", "Transactions", "Progress %", "Health /100", "Days"].includes(c.key)) return <span className="mono">{num(v)}</span>;
            return v === null || v === undefined || v === "" ? "—" : String(v);
          },
        }))}
      />
    </div>
  );
}
