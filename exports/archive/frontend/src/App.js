import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { Shell } from "@/components/Shell";
import { Login, Signup, ResetPassword } from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Expenses from "@/pages/Expenses";
import Income from "@/pages/Income";
import Deductions from "@/pages/Deductions";
import Workers from "@/pages/Workers";
import Attendance from "@/pages/Attendance";
import WorkerPayments from "@/pages/WorkerPayments";
import Materials from "@/pages/Materials";
import Purchases from "@/pages/Purchases";
import PurchaseOrders from "@/pages/PurchaseOrders";
import SiteReports from "@/pages/SiteReports";
import Suppliers from "@/pages/Suppliers";
import Transportation from "@/pages/Transportation";
import Ledgers from "@/pages/Ledgers";
import Invoices from "@/pages/Invoices";
import Quotations from "@/pages/Quotations";
import Reports from "@/pages/Reports";
import AuditLogs from "@/pages/AuditLogs";
import Settings from "@/pages/Settings";
import { BRAND } from "@/lib/fmt";
import { Moon } from "lucide-react";

const Splash = () => (
  <div className="grid min-h-screen place-items-center">
    <div className="text-center fade-up">
      <div className="mx-auto grid h-16 w-16 animate-pulse place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
        <Moon className="h-7 w-7 text-primary" />
      </div>
      <p className="mt-5 font-display text-lg font-extrabold">{BRAND.name}</p>
      <p className="text-[11px] uppercase tracking-[0.24em] text-primary">{BRAND.by}</p>
      <p className="mt-2 text-xs text-muted-foreground">{BRAND.subtitle}</p>
    </div>
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err)
      return (
        <div className="grid min-h-screen place-items-center px-6 text-center">
          <div>
            <p className="font-display text-xl font-bold">Something went wrong</p>
            <p className="mt-2 text-sm text-muted-foreground">{BRAND.name} · {BRAND.by}</p>
            <button className="mt-5 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground" onClick={() => window.location.reload()} data-testid="error-retry">
              Reload application
            </button>
          </div>
        </div>
      );
    return this.props.children;
  }
}

const SetupRequired = () => {
  const { signOut } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center px-6 py-12" data-testid="setup-required">
      <div className="panel max-w-xl p-8">
        <p className="font-display text-xl font-bold">Database setup required</p>
        <p className="mt-2 text-sm text-muted-foreground">
          You are signed in, but this Supabase project has no schema yet, so your profile could not be loaded.
        </p>
        <ol className="mt-4 space-y-2 text-sm">
          <li>1. Open <span className="mono text-primary">supabase/migration.sql</span> in the project files and copy all of it.</li>
          <li>2. In Supabase, go to <b>SQL Editor → New query</b>, paste it and press <b>Run</b>.</li>
          <li>3. Reload this page — the first registered account becomes the Owner.</li>
        </ol>
        <div className="mt-6 flex gap-2">
          <button className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground" onClick={() => window.location.reload()} data-testid="setup-reload">Reload</button>
          <button className="rounded-full border border-border px-5 py-2 text-sm" onClick={signOut} data-testid="setup-signout">Sign out</button>
        </div>
        <p className="mt-6 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{BRAND.name} · {BRAND.by}</p>
      </div>
    </div>
  );
};

const ProfileError = () => {
  const { refreshProfile, signOut } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center" data-testid="profile-error">
      <div>
        <p className="font-display text-xl font-bold">Unable to load your profile</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">We couldn't reach the server. Check your connection and try again.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground" onClick={refreshProfile} data-testid="profile-retry">Retry</button>
          <button className="rounded-full border border-border px-5 py-2 text-sm" onClick={signOut} data-testid="profile-signout">Sign out</button>
        </div>
      </div>
    </div>
  );
};

const Protected = ({ children }) => {
  const { session, loading, profile, profileMissing, profileError } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash />;
  if (!session) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (!profile && profileMissing) return <SetupRequired />;
  if (!profile && profileError) return <ProfileError />;
  if (!profile) return <Splash />;
  if (profile && profile.is_active === false)
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div><p className="font-display text-xl font-bold">Account disabled</p><p className="mt-2 text-sm text-muted-foreground">Contact the Owner to restore your access.</p></div>
      </div>
    );
  return children;
};

const PublicOnly = ({ children }) => {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  return session ? <Navigate to="/" replace /> : children;
};

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
            <Route path="/reset" element={<ResetPassword />} />
            <Route element={<Protected><Shell /></Protected>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/income" element={<Income />} />
              <Route path="/deductions" element={<Deductions />} />
              <Route path="/workers" element={<Workers />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/worker-payments" element={<WorkerPayments />} />
              <Route path="/materials" element={<Materials />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/site-reports" element={<SiteReports />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/transportation" element={<Transportation />} />
              <Route path="/ledgers" element={<Ledgers />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/quotations" element={<Quotations />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/audit" element={<AuditLogs />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
