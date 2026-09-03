import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { queueSnapshot, subscribeQueue, startAutoSync, retryItem } from "@/lib/offline";
import { BRAND } from "@/lib/fmt";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard, FolderKanban, Receipt, TrendingUp, HardHat, CalendarCheck, Wallet,
  Package, ShoppingCart, Building2, Truck, Landmark, FileBarChart, History, Settings,
  Menu, LogOut, Plus, WifiOff, Moon, MinusCircle, FileSignature, ClipboardList, RefreshCw, CloudUpload,
  ClipboardCheck, NotebookPen,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, module: "projects" },
  { to: "/projects", label: "Projects", icon: FolderKanban, module: "projects" },
  { to: "/expenses", label: "Expenses", icon: Receipt, module: "expenses" },
  { to: "/income", label: "Income", icon: TrendingUp, module: "incomes" },
  { to: "/deductions", label: "Deductions", icon: MinusCircle, module: "deductions" },
  { to: "/workers", label: "Workers", icon: HardHat, module: "workers" },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck, module: "attendance" },
  { to: "/worker-payments", label: "Worker Payments", icon: Wallet, module: "payments" },
  { to: "/materials", label: "Materials", icon: Package, module: "materials" },
  { to: "/purchases", label: "Purchases & Stock", icon: ShoppingCart, module: "purchases" },
  { to: "/purchase-orders", label: "Purchase Orders", icon: ClipboardCheck, module: "orders" },
  { to: "/suppliers", label: "Businesses", icon: Building2, module: "suppliers" },
  { to: "/transportation", label: "Transportation", icon: Truck, module: "transportation" },
  { to: "/site-reports", label: "Daily Site Reports", icon: NotebookPen, module: "sitereports" },
  { to: "/ledgers", label: "Ledgers", icon: Landmark, module: "ledgers" },
  { to: "/invoices", label: "Invoices", icon: FileSignature, module: "incomes" },
  { to: "/quotations", label: "Quotations", icon: ClipboardList, module: "reports" },
  { to: "/reports", label: "Reports", icon: FileBarChart, module: "reports" },
  { to: "/audit", label: "Audit Log", icon: History, module: "audit" },
  { to: "/settings", label: "Settings & Users", icon: Settings, module: "settings" },
];

const MOBILE = [NAV[0], NAV[1], NAV[2], NAV[6], NAV[13]];

export const Logo = ({ compact }) => (
  <div className="flex items-center gap-3">
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
      <Moon className="h-5 w-5 text-primary" />
    </div>
    {!compact && (
      <div className="leading-tight">
        <p className="font-display text-[13px] font-extrabold tracking-tight">{BRAND.name}</p>
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary">{BRAND.by}</p>
      </div>
    )}
  </div>
);

const NavList = ({ onNavigate }) => {
  const { can } = useAuth();
  return (
    <nav className="space-y-1">
      {NAV.filter((n) => can(n.module, "r")).map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === "/"}
          onClick={onNavigate}
          data-testid={`nav-${n.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
          className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}
        >
          <n.icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{n.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

const QuickAdd = () => {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const items = [
    ["Expense", "/expenses"], ["Income", "/income"], ["Worker", "/workers"],
    ["Attendance", "/attendance"], ["Material", "/materials"], ["Purchase", "/purchases"],
    ["Transportation", "/transportation"], ["Payment", "/worker-payments"],
    ["Deduction", "/deductions"], ["Invoice", "/invoices"],
    ["Daily Report", "/site-reports"], ["Purchase Order", "/purchase-orders"],
  ];
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          data-testid="quick-add-btn"
          className="fixed bottom-20 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform active:scale-95 lg:hidden"
        >
          <Plus className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl" data-testid="quick-add-sheet">
        <p className="label-xs mb-3">Quick Add</p>
        <div className="grid grid-cols-2 gap-3 pb-4">
          {items.map(([label, to]) => (
            <Button key={to + label} variant="secondary" className="h-14 justify-start rounded-2xl"
              data-testid={`quick-add-${label.toLowerCase()}`}
              onClick={() => { setOpen(false); nav(to); }}>
              {label}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const SyncStatus = () => {
  const qc = useQueryClient();
  const [snap, setSnap] = useState(queueSnapshot());
  const [busy, setBusy] = useState(false);

  React.useEffect(() => subscribeQueue(() => setSnap(queueSnapshot())), []);
  React.useEffect(() => startAutoSync(({ synced }) => {
    setSnap(queueSnapshot());
    qc.invalidateQueries();
    toast.success(`${synced} pending ${synced === 1 ? "entry" : "entries"} synchronised.`);
  }), [qc]);

  const retryAll = async () => {
    setBusy(true);
    for (const it of queueSnapshot().items) await retryItem(it.id);
    setSnap(queueSnapshot());
    qc.invalidateQueries();
    setBusy(false);
  };

  if (!snap.pending && !snap.failed) return null;
  return (
    <button onClick={retryAll} disabled={busy} data-testid="sync-status"
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${snap.failed ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
      {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
      {snap.failed ? `Failed sync (${snap.failed}) — retry` : `Pending sync (${snap.pending})`}
    </button>
  );
};

export const Shell = () => {
  const { profile, role, signOut } = useAuth();
  const [offline, setOffline] = useState(!navigator.onLine);
  React.useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-border/70 bg-card/40 p-4 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
        <Logo />
        <p className="mt-4 mb-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{BRAND.subtitle}</p>
        <NavList />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-xl">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="lg:hidden" data-testid="mobile-menu-btn"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto">
              <Logo />
              <div className="mt-6"><NavList /></div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1 lg:hidden"><Logo compact={false} /></div>
          <div className="hidden flex-1 lg:block" />
          <SyncStatus />
          {offline && (
            <span data-testid="offline-indicator" className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs text-destructive">
              <WifiOff className="h-3.5 w-3.5" /> Offline
            </span>
          )}
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight">{profile?.full_name || "User"}</p>
            <p className="text-[11px] capitalize text-primary">{String(role || "").replace("_", " ")}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={signOut} data-testid="logout-btn"><LogOut className="h-4 w-4" /></Button>
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-10"><Outlet /></main>

        <QuickAdd />
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border/70 bg-card/95 backdrop-blur-xl lg:hidden">
          {MOBILE.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}
              data-testid={`bottomnav-${n.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className={({ isActive }) => `flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] ${isActive ? "text-primary" : "text-muted-foreground"}`}>
              <n.icon className="h-5 w-5" />
              <span className="truncate px-1">{n.label.split(" ")[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};
