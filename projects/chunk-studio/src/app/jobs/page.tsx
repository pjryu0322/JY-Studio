"use client";

import JobList from "@/components/jobs/JobList";
import UploadPanel from "@/components/jobs/UploadPanel";
import JobDetail from "@/components/jobs/JobDetail";
import ScreenLabel from "@/components/entry/ScreenLabel";
import { useJobDetail } from "@/hooks/useJobDetail";
import { useJobRefresh } from "@/hooks/useJobRefresh";

export default function JobsPage() {
  const { selectedJob, detail, loading, error } = useJobDetail();
  useJobRefresh(2000);

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
          <JobDetail
            key={selectedJob?.id ?? "no-job"}
            selectedJob={selectedJob}
            detail={detail}
            loading={loading}
            error={error}
          />
        </div>
      </main>
    </div>
  );
}
