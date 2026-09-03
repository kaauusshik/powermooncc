import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Validate Supabase configuration
if (!url || !key) {
  console.error("❌ Supabase configuration missing!");
  console.error("Check your .env file has:");
  console.error("  REACT_APP_SUPABASE_URL=https://pddybafnmwkdzlqdhvra.supabase.co");
  console.error("  REACT_APP_SUPABASE_ANON_KEY=sb_publishable_DSBxiDuofaZr2MBZBNal8A_tMGHzDI9");
  throw new Error("Supabase URL or Key is missing. Check your .env file.");
}

// Warn if using invalid key format
if (key.startsWith("sb_publishable_")) {
  console.error("❌ INVALID SUPABASE KEY FORMAT!");
  console.error("Your key starts with 'sb_publishable_' which is incorrect.");
  console.error("Get the correct 'anon public' key from:");
  console.error(`  ${url.replace('/rest/v1', '')}/project/settings/api`);
  console.error("The correct key should start with 'eyJ' and be ~200 characters long.");
  throw new Error("Invalid Supabase API key format. Must use 'anon public' key starting with 'eyJ'");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const friendly = (error, fallback = "Something went wrong. Please try again.") => {
  const m = (error?.message || "").toLowerCase();
  if (!m) return fallback;
  if (m.includes("duplicate key") || m.includes("idem")) return "Duplicate transaction prevented.";
  if (m.includes("row-level security") || m.includes("permission denied")) return "Permission denied.";
  if (m.includes("invalid login")) return "Invalid email or password.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Unable to reach the server. Please check your connection.";
  if (m.includes("already registered")) return "This email is already registered.";
  return fallback;
};

export const newIdemKey = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
