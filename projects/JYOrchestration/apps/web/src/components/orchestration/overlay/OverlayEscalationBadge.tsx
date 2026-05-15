"use client";

/** H12.5 — escalation 수준 배지(read-only). */
export function OverlayEscalationBadge({
  escalationLabel,
}: {
  readonly escalationLabel: string;
}) {
  return (
    <div
      role="status"
      style={{
        display: "inline-flex",
        alignSelf: "flex-start",
        fontSize: 10,
        fontWeight: 800,
        lineHeight: 1.4,
        color: "#991b1b",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: 6,
        padding: "4px 8px",
      }}
    >
      Escalation: {escalationLabel}
    </div>
  );
}
