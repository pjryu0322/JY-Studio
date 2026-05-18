import type { ReactNode } from "react";

/** Lists driven by in-memory / demo data — keep visible so users do not confuse with live project progress. */
export function WorkflowDemoSampleBanner({ children }: { readonly children: ReactNode }) {
  return (
    <div
      role="note"
      aria-label="시연용 샘플 데이터 안내"
      style={{
        marginTop: 12,
        marginBottom: 4,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #fcd34d",
        background: "#fffbeb",
        fontSize: 13,
        color: "#78350f",
        lineHeight: 1.55,
      }}
    >
      <strong style={{ color: "#92400e" }}>시연용 샘플</strong>
      <span style={{ fontWeight: 500 }}> {children}</span>
    </div>
  );
}
