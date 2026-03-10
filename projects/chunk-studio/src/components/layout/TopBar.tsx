"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useJobStore } from "@/store/jobStore";

export default function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refresh = useJobStore((s) => s.refresh);
  const setSelectedJobId = useJobStore((s) => s.setSelectedJobId);
  const jobs = useJobStore((s) => s.jobs);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const [uploading, setUploading] = useState(false);
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 320,
          fontSize: 12,
          color: "#334155",
        }}
      >
        <strong style={{ fontSize: 13, color: "#0f172a" }}>문서 청킹 작업공간</strong>
        <span style={{ color: "#94a3b8" }}>/</span>
        <span
          style={{
            maxWidth: 280,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
          title={selectedJob?.originalFilename ?? "선택된 문서 없음"}
        >
          {selectedJob?.originalFilename ?? "선택된 문서 없음"}
        </span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
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
        {uploading ? "업로드 중..." : selectedJob ? "재업로드" : "PDF 업로드"}
      </button>
      <span style={{ fontSize: 12, color: "#666" }}>
        상태: {selectedJob?.status ?? "없음"}
      </span>
      <Link href="/jobs" style={{ marginLeft: "auto", fontSize: 12, textDecoration: "none" }}>
        작업목록 보기
      </Link>
    </header>
  );
}
