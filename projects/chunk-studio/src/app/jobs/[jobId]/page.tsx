"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Layout from "@/components/layout/Layout";
import ScreenLabel from "@/components/entry/ScreenLabel";
import { useJobStore } from "@/store/jobStore";

export default function JobWorkbenchPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId ?? "";
  const setSelectedJobId = useJobStore((s) => s.setSelectedJobId);
  const refresh = useJobStore((s) => s.refresh);

  useEffect(() => {
    if (!jobId) return;
    setSelectedJobId(jobId);
    void refresh();
  }, [jobId, setSelectedJobId, refresh]);

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px 0", maxWidth: 1240, width: "100%", margin: "0 auto" }}>
        <ScreenLabel screen="작업 상세" mode="Operator" context="구조/미리보기/청크 워크벤치" />
      </div>
      <Layout />
    </main>
  );
}
