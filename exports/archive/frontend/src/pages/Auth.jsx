import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase, friendly } from "@/lib/supabase";
import { BRAND } from "@/lib/fmt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Moon } from "lucide-react";

const Field = ({ label, type = "text", value, onChange, testId, ...rest }) => (
  <div>
    <Label className="label-xs mb-1.5 block">{label}</Label>
    <Input data-testid={testId} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="bg-secondary/50" {...rest} />
  </div>
);

const Frame = ({ children, mode }) => (
  <div className="min-h-screen lg:grid lg:grid-cols-2">
    <div className="relative hidden overflow-hidden border-r border-border/70 bg-card/40 p-12 lg:flex lg:flex-col lg:justify-between">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30"><Moon className="h-6 w-6 text-primary" /></div>
        <div>
          <p className="font-display text-lg font-extrabold leading-tight">{BRAND.name}</p>
          <p className="text-[11px] uppercase tracking-[0.24em] text-primary">{BRAND.by}</p>
        </div>
      </div>
      <div>
        <h2 className="font-display text-4xl font-bold leading-[1.1]">Every rupee.<br />Every site.<br /><span className="text-primary">Fully accounted.</span></h2>
        <p className="mt-5 max-w-md text-sm text-muted-foreground">{BRAND.subtitle} — projects, workers, attendance, materials, stock, ledgers, budgets and audit-grade financial history in one command centre.</p>
      </div>
      <div className="space-y-2 text-xs text-muted-foreground">
        <p className="text-[11px]">© 2026 Power Moon TechMed Pvt.Ltd, Bhubaneswar | Odisha. All rights reserved.</p>
      </div>
    </div>
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md fade-up">
        <div className="mb-8 lg:hidden">
          <p className="font-display text-base font-extrabold">{BRAND.name}</p>
          <p className="text-[11px] uppercase tracking-[0.24em] text-primary">{BRAND.by}</p>
        </div>
        <div className="panel p-6 sm:p-8">{children}</div>
        <p className="mt-6 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{mode}</p>
        <p className="mt-3 text-center text-[10px] text-muted-foreground">© 2026 Power Moon TechMed Pvt.Ltd, Bhubaneswar | Odisha. All rights reserved.</p>
      </div>
    </div>
  </div>
);

export const Login = () => {
  const nav = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [show, setShow] = useState(false); const [busy, setBusy] = useState(false);
  const [view, setView] = useState("login");

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    if (view === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset` });
      setBusy(false);
      if (error) return toast.error(friendly(error, "Unable to send reset email."));
      return toast.success("Password reset link sent to your email.");
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      const { data: p } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
      if (p && p.is_active === false) {
        await supabase.auth.signOut(); setBusy(false);
        return toast.error("This account has been disabled. Contact the owner.");
      }
    }
    setBusy(false);
    if (error) return toast.error(friendly(error, "Unable to sign in."));
    toast.success("Welcome back.");
    nav("/");
  };

  return (
    <Frame mode={view === "forgot" ? "Password recovery" : "Secure sign in"}>
      <h1 className="font-display text-2xl font-bold">{view === "forgot" ? "Reset password" : "Sign in"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{BRAND.subtitle}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} testId="login-email" required />
        {view === "login" && (
          <div>
            <Label className="label-xs mb-1.5 block">Password</Label>
            <div className="relative">
              <Input data-testid="login-password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="bg-secondary/50 pr-10" required />
              <button type="button" data-testid="toggle-password" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
        <Button type="submit" className="w-full rounded-full" disabled={busy} data-testid="login-submit">
          {busy ? "Please wait…" : view === "forgot" ? "Send reset link" : "Sign in"}
        </Button>
      </form>
      <div className="mt-5 flex items-center justify-between text-sm">
        <button className="text-muted-foreground hover:text-primary" data-testid="forgot-link" onClick={() => setView(view === "forgot" ? "login" : "forgot")}>
          {view === "forgot" ? "Back to sign in" : "Forgot password?"}
        </button>
        <button className="text-primary" data-testid="goto-signup" onClick={() => nav("/signup")}>Create account</button>
      </div>
    </Frame>
  );
};

export const Signup = () => {
  const nav = useNavigate();
  const [v, setV] = useState({ full_name: "", email: "", phone: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  const set = (k) => (val) => setV((p) => ({ ...p, [k]: val }));

  const submit = async (e) => {
    e.preventDefault();
    if (v.password.length < 6) return toast.error("Password must be at least 6 characters.");
    if (v.password !== v.confirm) return toast.error("Passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: v.email, password: v.password,
      options: { data: { full_name: v.full_name, phone: v.phone } },
    });
    setBusy(false);
    if (error) return toast.error(friendly(error, "Unable to create account."));
    toast.success("Account created. You can sign in now.");
    nav("/login");
  };

  return (
    <Frame mode="Create your account">
      <h1 className="font-display text-2xl font-bold">Create account</h1>
      <p className="mt-1 text-sm text-muted-foreground">The first account created becomes the Owner.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Full Name" value={v.full_name} onChange={set("full_name")} testId="signup-name" required />
        <Field label="Email" type="email" value={v.email} onChange={set("email")} testId="signup-email" required />
        <Field label="Phone" value={v.phone} onChange={set("phone")} testId="signup-phone" inputMode="tel" />
        <div>
          <Label className="label-xs mb-1.5 block">Password</Label>
          <div className="relative">
            <Input data-testid="signup-password" type={show ? "text" : "password"} value={v.password} onChange={(e) => set("password")(e.target.value)} className="bg-secondary/50 pr-10" required />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Field label="Confirm Password" type={show ? "text" : "password"} value={v.confirm} onChange={set("confirm")} testId="signup-confirm" required />
        <Button type="submit" className="w-full rounded-full" disabled={busy} data-testid="signup-submit">{busy ? "Creating…" : "Create account"}</Button>
      </form>
      <button className="mt-5 text-sm text-primary" data-testid="goto-login" onClick={() => nav("/login")}>Already have an account? Sign in</button>
    </Frame>
  );
};

export const ResetPassword = () => {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(friendly(error, "Unable to update password. The link may have expired."));
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    nav("/login");
  };
  return (
    <Frame mode="Set a new password">
      <h1 className="font-display text-2xl font-bold">New password</h1>
      <p className="mt-1 text-sm text-muted-foreground">{sp.get("error_description") || "Choose a strong password you'll remember."}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="New Password" type="password" value={password} onChange={setPassword} testId="reset-password" required />
        <Button type="submit" className="w-full rounded-full" disabled={busy} data-testid="reset-submit">{busy ? "Updating…" : "Update password"}</Button>
      </form>
    </Frame>
  );
};
