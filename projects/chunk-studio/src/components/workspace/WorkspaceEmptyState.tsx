"use client";

import type { RefObject } from "react";

interface WorkspaceEmptyStateProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUpload: (file: File | null) => Promise<void>;
}

export default function WorkspaceEmptyState({ fileInputRef, onUpload }: WorkspaceEmptyStateProps) {
  return (
    <section className="workspace-shell" style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center", display: "grid", gap: 10 }}>
        <strong style={{ fontSize: 22, color: "#0f172a" }}>Drop PDF here</strong>
        <span style={{ fontSize: 13, color: "#64748b" }}>or click to upload</span>
        <button type="button" onClick={() => fileInputRef.current?.click()} style={uploadButtonStyle}>
          PDF 업로드
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            void onUpload(file);
          }}
        />
      </div>
    </section>
  );
}

const uploadButtonStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  fontSize: 12,
  padding: "6px 10px",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
} as const;
