import React, { useState } from "react";
import { uploadFile, signedUrl, downloadFile } from "@/lib/storage";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Upload, Eye, Download, X, Loader2 } from "lucide-react";

export const FileField = ({ value, onChange, folder = "receipts", testId }) => {
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadFile(file, { folder });
      onChange(path);
      toast.success("Receipt uploaded.");
    } catch (err) {
      toast.error(err?.message?.includes("supported") || err?.message?.includes("too large")
        ? err.message : "Unable to upload receipt. Please check your connection.");
    } finally { setBusy(false); e.target.value = ""; }
  };

  const view = async () => {
    try { window.open(await signedUrl(value), "_blank", "noopener"); }
    catch { toast.error("Unable to open the receipt."); }
  };

  return (
    <div className="space-y-2">
      {!value ? (
        <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/40 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? "Uploading…" : "Upload JPG, PNG, WEBP or PDF"}
          <input data-testid={testId} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={pick} disabled={busy} />
        </label>
      ) : (
        <div className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-xs" data-testid={`${testId}-name`}>{String(value).split("/").pop()}</span>
          <Button type="button" size="icon" variant="ghost" onClick={view} data-testid={`${testId}-view`}><Eye className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => downloadFile(value, String(value).split("/").pop())} data-testid={`${testId}-download`}><Download className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => onChange("")} data-testid={`${testId}-remove`}><X className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
};
