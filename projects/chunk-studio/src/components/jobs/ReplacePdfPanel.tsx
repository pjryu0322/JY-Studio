"use client";

import { useRef, useState } from "react";
import { useJobStore } from "@/store/jobStore";

interface Props {
  jobId: string;
}

export default function ReplacePdfPanel({ jobId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { refresh } = useJobStore();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    inputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf")) {
      setError("Only PDF files (.pdf) are allowed.");
      return;
    }
    if (file.type && file.type !== "application/pdf") {
      setError("Invalid MIME type. Expected application/pdf.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/jobs/${jobId}/replace-pdf`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Upload failed (${res.status})`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload replacement PDF.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 6,
        border: "1px solid #e65100",
        background: "#fff3e0",
      }}
    >
      <p style={{ margin: "0 0 6px", fontSize: 13, color: "#e65100" }}>
        HWP/HWPX is not supported. Please upload a PDF replacement.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        onChange={handleChange}
        style={{ display: "none" }}
        aria-label="Upload replacement PDF"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={uploading}
        style={{
          padding: "6px 12px",
          fontSize: 13,
          cursor: uploading ? "not-allowed" : "pointer",
          background: "#fff",
          borderRadius: 4,
          border: "1px solid #e65100",
          color: "#e65100",
        }}
      >
        {uploading ? "Uploading…" : "Choose PDF"}
      </button>
      {error && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "#c62828",
          }}
        >
          {error}
        </div>
      )}
    </section>
  );
}

