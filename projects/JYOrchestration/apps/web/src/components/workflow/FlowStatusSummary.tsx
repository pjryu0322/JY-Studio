"use client";

export function FlowStatusSummary({ lines }: { readonly lines: readonly string[] }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        background: "#fafafa",
        fontSize: 13,
        color: "#334155",
        lineHeight: 1.55,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6, color: "#0f172a" }}>현재 상태</div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {lines.map((line, idx) => (
          <li key={idx}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
