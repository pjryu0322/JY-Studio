"use client";

import Link from "next/link";
import { useRecentJobs } from "./useRecentJobs";

export default function SystemAlertsPanel() {
  const { alerts, loading } = useRecentJobs();

  return (
    <section
      style={{
        border: "1px solid rgba(87, 120, 255, 0.2)",
        borderRadius: 16,
        background: "#fff",
        padding: 14,
        boxShadow: "0 10px 24px rgba(25, 36, 67, 0.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 15, color: "#132547" }}>🚨 시스템 알림</h4>
        <Link href="/admin" style={{ fontSize: 12, color: "#3156b9", textDecoration: "none" }}>
          전체 보기
        </Link>
      </div>
      {loading ? (
        <div style={{ display: "grid", gap: 6 }}>
          {Array.from({ length: 3 }, (_, idx) => (
            <div
              key={`alerts-loading-${idx}`}
              style={{
                height: 36,
                borderRadius: 8,
                border: "1px solid #eef2ff",
                background: "linear-gradient(90deg, #f8fbff 0%, #edf3ff 50%, #f8fbff 100%)",
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <AlertRow label="실패 작업" value={alerts.failed} color="#c62828" />
          <AlertRow label="조치 필요" value={alerts.actionRequired} color="#ef6c00" />
          <AlertRow label="진행 중 파이프라인" value={alerts.running} color="#1565c0" />
        </div>
      )}
    </section>
  );
}

function AlertRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        border: "1px solid rgba(148, 163, 184, 0.25)",
        borderRadius: 8,
        padding: "8px 10px",
        background: "#fcfdff",
      }}
    >
      <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
      <strong style={{ fontSize: 14, color }}>{value}</strong>
    </div>
  );
}
