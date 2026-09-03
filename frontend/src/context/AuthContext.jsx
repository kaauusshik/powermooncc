import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const ROLE_MATRIX = {
  owner: { all: true },
  manager: { projects: "w", expenses: "w", incomes: "w", workers: "w", attendance: "w", payments: "w", materials: "w", purchases: "w", orders: "w", suppliers: "w", transportation: "w", deductions: "w", sitereports: "w", ledgers: "r", reports: "w", audit: "r", users: "n", settings: "r" },
  accountant: { projects: "r", expenses: "w", incomes: "w", workers: "r", attendance: "r", payments: "w", materials: "r", purchases: "r", orders: "w", suppliers: "w", transportation: "r", deductions: "w", sitereports: "r", ledgers: "w", reports: "w", audit: "r", users: "n", settings: "n" },
  site_staff: { projects: "r", expenses: "w", incomes: "n", workers: "w", attendance: "w", payments: "n", materials: "w", purchases: "w", orders: "w", suppliers: "r", transportation: "w", deductions: "n", sitereports: "w", ledgers: "n", reports: "r", audit: "n", users: "n", settings: "n" },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Retries transient failures so a valid user never sees the setup screen.
  const loadProfile = useCallback(async (uid) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (!error) {
        setProfileError(null);
        setProfile(data || null);
        setProfileMissing(!data);
        return data;
      }
      setProfileError(error);
      await sleep(500 * (attempt + 1));
    }
    setProfileMissing(false);
    return null;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) loadProfile(s.user.id);
      else { setProfile(null); setProfileMissing(false); setProfileError(null); }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const role = profile?.role || null;

  const can = useCallback((module, level = "r") => {
    if (!role) return false;
    if (role === "owner") return true;
    const v = ROLE_MATRIX[role]?.[module] || "n";
    if (v === "n") return false;
    if (level === "r") return true;
    return v === "w";
  }, [role]);

  const canDelete = useCallback(() => role === "owner", [role]);

  const value = {
    session, user: session?.user || null, profile, role, loading, can, canDelete,
    profileMissing, profileError,
    refreshProfile: () => session?.user && loadProfile(session.user.id),
    signOut: () => supabase.auth.signOut(),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};
