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
      <div style={{ display: "grid", gap: 2 }}>
        <Link href="/" className="top-bar__title" style={{ textDecoration: "none", color: "#122549" }}>
          Chunk Studio
        </Link>
        <span style={{ fontSize: 11, color: "#64748b" }}>Chunk Studio / Operator / 작업 상세</span>
      </div>
      <Link href="/workspace" style={{ fontSize: 12, textDecoration: "none" }}>
        작업공간
      </Link>
      <Link href="/jobs" style={{ fontSize: 12, textDecoration: "none" }}>
        최근 작업
      </Link>
      <Link href="/admin" style={{ fontSize: 12, textDecoration: "none" }}>
        관리자
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
        {uploading ? "업로드 중..." : "새 문서 업로드"}
      </button>
      <span style={{ fontSize: 12, color: "#666" }}>
        작업 상태: {selectedJob?.status ?? "없음"}
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
        템플릿 빌더
      </button>
      <Link
        href={selectedJob?.id ? `/jobs/${selectedJob.id}` : "/jobs"}
        style={{ marginLeft: "auto", fontSize: 12, textDecoration: "none" }}
      >
        작업 상세 바로가기
      </Link>
    </header>
  );
}
