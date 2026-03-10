"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Layout from "@/components/layout/Layout";
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
      <Layout />
    </main>
  );
}
