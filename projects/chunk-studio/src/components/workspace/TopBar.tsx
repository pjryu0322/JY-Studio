"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useJobStore } from "@/store/jobStore";

function toStatusLabel(status: string | undefined): string {
  if (!status) return "없음";
  if (status === "QUEUED") return "분석 대기";
  if (["CONVERTING", "PDF_READY", "EXTRACTING_TEXT", "CHUNKING"].includes(status)) return "분석 중";
  if (status === "DONE") return "분석 완료";
  if (status === "FAILED") return "실패";
  if (status === "ACTION_REQUIRED") return "확인 필요";
  return status;
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M19.4 13.5L21 12L19.4 10.5L19.6 8.3L17.4 8L16.4 6L14.4 6.7L12.8 5L11.2 6.7L9.2 6L8.2 8L6 8.3L6.2 10.5L4.6 12L6.2 13.5L6 15.7L8.2 16L9.2 18L11.2 17.3L12.8 19L14.4 17.3L16.4 18L17.4 16L19.6 15.7L19.4 13.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface TopBarProps {
  showLabels: boolean;
}

export default function TopBar({ showLabels }: TopBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refresh = useJobStore((s) => s.refresh);
  const setSelectedJobId = useJobStore((s) => s.setSelectedJobId);
  const jobs = useJobStore((s) => s.jobs);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const [uploading, setUploading] = useState(false);

  const preferredJob = useMemo(
    () => jobs.find((job) => job.status === "DONE") ?? jobs[0] ?? null,
    [jobs]
  );
  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) ?? preferredJob,
    [jobs, selectedJobId, preferredJob]
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
    <header className="workspace-topbar">
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
        {showLabels && <span className="workspace-ui-label">Top Bar</span>}
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
        상태: {toStatusLabel(selectedJob?.status)}
      </span>
      <Link
        href="/workspace/settings"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          border: "1px solid #d1d5db",
          borderRadius: 8,
          color: "#334155",
        }}
        aria-label="작업공간 설정"
        title="작업공간 설정"
      >
        <SettingsIcon />
      </Link>
      <Link href="/jobs" style={{ marginLeft: "auto", fontSize: 12, textDecoration: "none" }}>
        작업목록 보기
      </Link>
    </header>
  );
}
