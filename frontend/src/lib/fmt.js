export const BRAND = {
  name: "POWER MOON CONSTRUCTION",
  by: "by KUSIK",
  subtitle: "Construction Management & Expense Tracking",
};

export const money = (n) =>
  "₹" +
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const shortMoney = (n) => {
  const v = Number(n || 0);
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  if (a >= 1e3) return `₹${(v / 1e3).toFixed(1)} K`;
  return `₹${v.toFixed(0)}`;
};

export const num = (n, d = 2) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: d });

export const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const today = () => new Date().toISOString().slice(0, 10);

export const titleCase = (s) =>
  String(s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const PAYMENT_METHODS = ["cash", "upi", "neft", "bank_transfer", "card", "cheque", "other"];
export const EXPENSE_CATEGORIES = ["labor", "material", "contractor", "transportation", "food", "travel", "hotel", "equipment", "other"];
export const WORKER_TYPES = ["Mason", "Helper", "Plumber", "Electrician", "Carpenter", "Painter", "Tile Worker", "Driver", "Other"];
export const UNITS = ["bag", "cft", "nos", "kg", "sqft", "litre", "mtr", "ton", "brass", "trip"];
export const PROJECT_STATUS = ["planning", "active", "on_hold", "completed", "archived"];
export const DEDUCTION_KINDS = ["advance_adjustment", "material", "labor", "damage", "penalty", "client", "other"];

export const ledgerBucket = (method) => {
  if (method === "cash") return "cash";
  if (method === "upi") return "upi";
  if (["neft", "bank_transfer", "card", "cheque"].includes(method)) return "bank";
  return "other";
};

export const dateRangeFor = (preset) => {
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const start = new Date(now), end = new Date(now);
  switch (preset) {
    case "today": break;
    case "yesterday": start.setDate(now.getDate() - 1); end.setDate(now.getDate() - 1); break;
    case "week": start.setDate(now.getDate() - now.getDay()); break;
    case "month": start.setDate(1); break;
    case "prev_month": start.setMonth(now.getMonth() - 1, 1); end.setDate(0); break;
    case "year": start.setMonth(0, 1); break;
    default: return { from: null, to: null };
  }
  return { from: iso(start), to: iso(end) };
};
