import { supabase } from "./supabase";

const BUCKET = "documents";
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_BYTES = 10 * 1024 * 1024;

export const uploadFile = async (file, { folder = "misc", projectId = null, entityTable = null, entityId = null } = {}) => {
  if (!ALLOWED.includes(file.type)) throw new Error("Only JPG, PNG, WEBP and PDF files are supported.");
  if (file.size > MAX_BYTES) throw new Error("File is too large. Maximum size is 10 MB.");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  await supabase.from("attachments").insert({
    bucket: BUCKET, path, file_name: file.name, mime_type: file.type, size_bytes: file.size,
    entity_table: entityTable, entity_id: entityId, project_id: projectId,
  });
  return path;
};

export const signedUrl = async (path, expiresIn = 3600) => {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
};

export const downloadFile = async (path, fileName = "receipt") => {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
};
