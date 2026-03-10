"use client";

import { useEffect } from "react";
import { useJobStore } from "@/store/jobStore";
import JobList from "@/components/jobs/JobList";
import UploadPanel from "@/components/jobs/UploadPanel";
import JobDetail from "@/components/jobs/JobDetail";

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
