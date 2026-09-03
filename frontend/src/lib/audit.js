import { supabase } from "./supabase";

export const logAudit = async ({ action, table, recordId, projectId, oldValue, newValue, userName }) => {
  try {
    await supabase.from("audit_logs").insert({
      action, table_name: table, record_id: recordId || null,
      project_id: projectId || null, user_name: userName || null,
      old_value: oldValue || null, new_value: newValue || null,
    });
  } catch (e) { /* audit failures must never block the user */ }
};
