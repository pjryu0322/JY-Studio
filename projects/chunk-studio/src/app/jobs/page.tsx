"use client";

import { useEffect } from "react";
import { useJobStore } from "@/store/jobStore";
import JobList from "@/components/jobs/JobList";
import UploadPanel from "@/components/jobs/UploadPanel";
import JobDetail from "@/components/jobs/JobDetail";
import ScreenLabel from "@/components/entry/ScreenLabel";

export default function JobsPage() {
  const refresh = useJobStore((s) => s.refresh);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      refresh();
    }, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px", maxWidth: 1240, width: "100%", margin: "0 auto" }}>
        <ScreenLabel screen="최근 작업" mode="Operator" context="작업 목록 및 상세 검토" />
      </div>
      <UploadPanel />
      <main
        style={{
          flex: 1,
          display: "flex",
          minHeight: 0,
        }}
      >
        <div style={{ width: 280, minWidth: 220, maxWidth: 360, borderRight: "1px solid #ddd" }}>
          <JobList />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <JobDetail />
        </div>
      </main>
    </div>
  );
}
