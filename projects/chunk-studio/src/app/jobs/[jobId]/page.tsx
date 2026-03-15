"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import JobDetail from "@/components/jobs/JobDetail";
import ScreenLabel from "@/components/entry/ScreenLabel";
import { useJobDetail } from "@/hooks/useJobDetail";
import { useJobRefresh } from "@/hooks/useJobRefresh";
import { useJobStore } from "@/store/jobStore";

export default function JobWorkbenchPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId ?? "";
  const setSelectedJobId = useJobStore((s) => s.setSelectedJobId);
  const refresh = useJobStore((s) => s.refresh);
  const { selectedJob, detail, loading, error } = useJobDetail();

  useJobRefresh(3000);

  useEffect(() => {
    if (!jobId) return;
    setSelectedJobId(jobId);
    void refresh();
  }, [jobId, setSelectedJobId, refresh]);

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px 0", maxWidth: 1240, width: "100%", margin: "0 auto" }}>
        <ScreenLabel screen="작업 상세" mode="Operator" context="운영 이력 확인" />
        <div style={{ marginTop: 6, display: "flex", gap: 10 }}>
          <Link href="/jobs" style={{ fontSize: 12, color: "#3156b9", textDecoration: "none" }}>
            작업 목록
          </Link>
          <Link href="/workspace" style={{ fontSize: 12, color: "#3156b9", textDecoration: "none" }}>
            작업공간으로 이동
          </Link>
        </div>
      </div>
      <div style={{ maxWidth: 1240, width: "100%", margin: "0 auto", padding: "12px 16px 20px", flex: 1 }}>
        <JobDetail
          key={selectedJob?.id ?? "no-job"}
          selectedJob={selectedJob}
          detail={detail}
          loading={loading}
          error={error}
        />
      </div>
    </main>
  );
}
