"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useJobStore } from "@/store/jobStore";

export default function TopBar() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refresh = useJobStore((s) => s.refresh);
  const setSelectedJobId = useJobStore((s) => s.setSelectedJobId);
  const jobs = useJobStore((s) => s.jobs);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const [uploading, setUploading] = useState(false);
  const [family, setFamily] = useState("default/general");
  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId]
  );

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/jobs", { method: "POST", body: formData });
      const payload = (await res.json().catch(() => ({}))) as { jobId?: string };
      if (payload.jobId) setSelectedJobId(payload.jobId);
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  return (
    <header className="top-bar">
      <Link href="/" className="top-bar__title">
        Chunk Studio
      </Link>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.md,.hwp,.hwpx"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = "";
          void handleUpload(file);
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        style={{ padding: "6px 10px", fontSize: 12 }}
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>
      <span style={{ fontSize: 12, color: "#666" }}>
        job: {selectedJob?.status ?? "none"}
      </span>
      <input
        value={family}
        onChange={(e) => setFamily(e.target.value)}
        style={{ fontSize: 12, padding: "6px 8px", width: 170 }}
        placeholder="template family"
      />
      <button
        type="button"
        onClick={() =>
          router.push(
            `/templates/builder?jobId=${encodeURIComponent(
              selectedJob?.id ?? ""
            )}&family=${encodeURIComponent(family)}`
          )
        }
        style={{ padding: "6px 10px", fontSize: 12 }}
      >
        Template Builder
      </button>
      <Link href="/jobs" style={{ marginLeft: "auto", fontSize: 12 }}>
        Jobs View
      </Link>
    </header>
  );
}
