"use client";

import type { Job, JobDetailDTO } from "@/types/job";

interface JobDetailProps {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  loading: boolean;
  error: string | null;
}

export default function JobDetail({ selectedJob, detail, loading, error }: JobDetailProps) {
  if (!selectedJob) {
    return (
      <section style={panelStyle}>
        <div style={mutedText}>작업을 선택해 주세요.</div>
      </section>
    );
  }

  if (loading) {
    return (
      <section style={panelStyle}>
        <div style={mutedText}>작업 상세를 불러오는 중입니다.</div>
      </section>
    );
  }

  if (error) {
    return (
      <section style={panelStyle}>
        <div style={errorText}>{error}</div>
      </section>
    );
  }

  const chunkCount = detail?.chunks.length ?? 0;
  const fileName = selectedJob.originalFilename ?? selectedJob.id;
  const createdAt = new Date(selectedJob.createdAt);
  const createdLabel = Number.isNaN(createdAt.getTime()) ? "-" : createdAt.toLocaleString();

  return (
    <section style={panelStyle}>
      <div style={{ display: "grid", gap: 4 }}>
        <strong style={{ fontSize: 16, color: "#0f172a" }}>{fileName}</strong>
        <div style={metaText}>상태: {selectedJob.status}</div>
        <div style={metaText}>생성일: {createdLabel}</div>
      </div>

      <div style={statsGrid}>
        <StatCard label="청크 수" value={String(chunkCount)} />
        <StatCard label="추출 방식" value={detail?.extractionMethod ?? "-"} />
        <StatCard label="파이프라인 버전" value={detail?.pipelineVersion ?? "-"} />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <strong style={{ fontSize: 13, color: "#334155" }}>메시지</strong>
        <div style={messageBox}>{selectedJob.message ?? "메시지가 없습니다."}</div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <strong style={{ fontSize: 13, color: "#334155" }}>오류 상세</strong>
        <div style={messageBox}>{selectedJob.errorDetail ?? "-"}</div>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        background: "#fff",
        padding: 10,
        display: "grid",
        gap: 3,
      }}
    >
      <span style={{ fontSize: 11, color: "#64748b" }}>{label}</span>
      <strong style={{ fontSize: 14, color: "#0f172a" }}>{value}</strong>
    </div>
  );
}

const panelStyle = {
  height: "100%",
  overflowY: "auto",
  padding: 16,
  display: "grid",
  alignContent: "start",
  gap: 14,
  background: "#f8fafc",
} as const;

const statsGrid = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
} as const;

const messageBox = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#fff",
  padding: 10,
  fontSize: 12,
  color: "#334155",
  whiteSpace: "pre-wrap",
  lineHeight: 1.5,
} as const;

const mutedText = { fontSize: 13, color: "#64748b" } as const;
const metaText = { fontSize: 12, color: "#64748b" } as const;
const errorText = { fontSize: 13, color: "#b91c1c" } as const;

