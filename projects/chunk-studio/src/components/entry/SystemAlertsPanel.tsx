"use client";

import { useRecentJobs } from "./useRecentJobs";

export default function SystemAlertsPanel() {
  const { alerts, loading } = useRecentJobs();

  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 10, background: "#fff", padding: 12 }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>System Alerts</h4>
      {loading ? (
        <div style={{ fontSize: 12, color: "#666" }}>Loading...</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <AlertRow label="Failed jobs" value={alerts.failed} color="#c62828" />
          <AlertRow label="Action required" value={alerts.actionRequired} color="#ef6c00" />
          <AlertRow label="Running pipeline jobs" value={alerts.running} color="#1565c0" />
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
        border: "1px solid #eee",
        borderRadius: 8,
        padding: "8px 10px",
      }}
    >
      <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
      <strong style={{ fontSize: 14, color }}>{value}</strong>
    </div>
  );
}
