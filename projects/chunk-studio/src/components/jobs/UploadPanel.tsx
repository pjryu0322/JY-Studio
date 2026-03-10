"use client";

import { useRef, useState } from "react";
import { useJobStore } from "@/store/jobStore";

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.md,.hwp,.hwpx";

interface UploadResponse {
  jobId?: string;
  error?: string;
}

export default function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { refresh, setSelectedJobId } = useJobStore();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    fetch("/api/jobs", { method: "POST", body: formData })
      .then(async (res) => {
        const payload = (await res.json().catch(() => ({}))) as UploadResponse;
        if (!res.ok) {
          throw new Error(payload.error ?? `Upload failed (${res.status})`);
        }
        if (payload.jobId) setSelectedJobId(payload.jobId);
        await refresh();
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Upload failed");
      })
      .finally(() => {
        setUploading(false);
      });
  };

  return (
    <section style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            upload(file);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
        >
          {uploading ? "Uploading..." : "Upload file"}
        </button>
        <span style={{ fontSize: 12, color: "#666" }}>
          .pdf / .doc / .docx / .ppt / .pptx / .md / .hwp / .hwpx
        </span>
      </div>
      {error && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#c62828" }}>{error}</div>
      )}
    </section>
  );
}

