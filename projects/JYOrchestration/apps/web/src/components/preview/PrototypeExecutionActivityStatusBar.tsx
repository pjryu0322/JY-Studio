"use client";

import type { PrototypeExecutionActivityStatus } from "@/lib/prototype/prototypeExecutionActivityStatus";

export function PrototypeExecutionActivityStatusBar({
  status,
}: {
  readonly status: PrototypeExecutionActivityStatus;
}) {
  if (!status.active) return null;

  return (
    <div
      data-testid="prototype-execution-activity-status"
      role="status"
      aria-live="polite"
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        padding: "8px 14px",
        margin: "0 12px 8px",
        borderRadius: 10,
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
        fontSize: 12,
        fontWeight: 700,
        color: "#1e40af",
        lineHeight: 1.35,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: "2px solid #93c5fd",
          borderTopColor: "#1d4ed8",
          animation: "jyo-proto-spin 0.8s linear infinite",
          flexShrink: 0,
        }}
      />
      <span>{status.label}</span>
      {status.detail ? (
        <span style={{ fontWeight: 600, color: "#3b82f6" }}>{status.detail}</span>
      ) : null}
    </div>
  );
}
