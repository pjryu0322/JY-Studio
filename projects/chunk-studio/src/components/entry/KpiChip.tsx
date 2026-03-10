"use client";

interface KpiChipProps {
  label: string;
  value: string;
  tone: "info" | "danger" | "neutral" | "warning";
}

export default function KpiChip({ label, value, tone }: KpiChipProps) {
  const toneStyle =
    tone === "danger"
      ? {
          border: "1px solid rgba(211, 47, 47, 0.24)",
          background: "rgba(255, 235, 238, 0.86)",
          color: "#b71c1c",
        }
      : tone === "info"
        ? {
            border: "1px solid rgba(30, 136, 229, 0.24)",
            background: "rgba(227, 242, 253, 0.86)",
            color: "#0d47a1",
          }
        : tone === "warning"
          ? {
              border: "1px solid rgba(251, 146, 60, 0.26)",
              background: "rgba(255, 247, 237, 0.94)",
              color: "#9a3412",
            }
          : {
              border: "1px solid rgba(100, 116, 139, 0.24)",
              background: "rgba(248, 250, 252, 0.9)",
              color: "#334155",
            };

  return (
    <div
      style={{
        ...toneStyle,
        borderRadius: 999,
        padding: "6px 10px",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800 }}>{value}</span>
    </div>
  );
}
