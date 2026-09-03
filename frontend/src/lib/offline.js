import { supabase, newIdemKey } from "./supabase";

const KEY = "pmc_offline_queue";
const EVT = "pmc-queue-change";

const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const write = (list) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
};

export const queueSnapshot = () => {
  const list = read();
  return { items: list, pending: list.filter((i) => i.status !== "failed").length, failed: list.filter((i) => i.status === "failed").length };
};

export const subscribeQueue = (fn) => {
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
};

export const enqueue = ({ table, payload, rpc, label }) => {
  const list = read();
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    table, payload, rpc, label,
    idem_key: payload?.p_idem_key || payload?.idem_key || newIdemKey(),
    status: "pending", error: null, created_at: new Date().toISOString(),
  };
  list.push(item);
  write(list);
  return item;
};

export const removeItem = (id) => write(read().filter((i) => i.id !== id));

export const retryItem = (id) => {
  write(read().map((i) => (i.id === id ? { ...i, status: "pending", error: null } : i)));
  return syncQueue();
};

let syncing = false;

export const syncQueue = async () => {
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0, failed = 0;
  try {
    for (const item of read()) {
      if (item.status === "failed") continue;
      try {
        if (item.rpc) {
          const { error } = await supabase.rpc(item.rpc, { ...item.payload, p_idem_key: item.idem_key });
          if (error) throw error;
        } else {
          const { error } = await supabase.from(item.table).insert({ ...item.payload, idem_key: item.idem_key });
          if (error) throw error;
        }
        removeItem(item.id);
        synced += 1;
      } catch (e) {
        const msg = (e?.message || "").toLowerCase();
        if (msg.includes("duplicate key")) { removeItem(item.id); synced += 1; continue; }
        if (msg.includes("failed to fetch") || msg.includes("network")) break;
        write(read().map((i) => (i.id === item.id ? { ...i, status: "failed", error: e?.message || "Sync failed" } : i)));
        failed += 1;
      }
    }
  } finally { syncing = false; }
  return { synced, failed };
};

export const startAutoSync = (onSynced) => {
  const run = async () => {
    const r = await syncQueue();
    if (r.synced > 0) onSynced?.(r);
  };
  window.addEventListener("online", run);
  const timer = setInterval(run, 30_000);
  run();
  return () => { window.removeEventListener("online", run); clearInterval(timer); };
};

export const isOfflineError = (e) => {
  const m = (e?.message || "").toLowerCase();
  return !navigator.onLine || m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed");
};
