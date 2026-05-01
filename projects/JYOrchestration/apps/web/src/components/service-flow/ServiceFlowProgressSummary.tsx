"use client";

/** 헤더 배지와 겹치지 않도록 보조 힌트·안내만 카드로 표시합니다. */
export function ServiceFlowProgressSummary(p: {
  readonly hint?: string | null;
  readonly helperLine?: string | null;
}) {
  const showHint = Boolean(p.hint?.trim());
  const showHelper = Boolean(p.helperLine?.trim());
  if (!showHint && !showHelper) return null;

  return (
    <div
      style={{
        flex: "0 0 auto",
        margin: "0 20px 10px",
        maxWidth: 720,
        width: "calc(100% - 40px)",
        boxSizing: "border-box",
        marginLeft: "auto",
        marginRight: "auto",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: "10px 12px",
        background: "#fff",
        boxShadow: "0 4px 14px -8px rgba(15, 23, 42, 0.12)",
      }}
    >
      {showHint ? (
        <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", lineHeight: 1.45 }}>{p.hint}</div>
      ) : null}
      {showHelper ? (
        <div style={{ marginTop: showHint ? 6 : 0, fontSize: 12, fontWeight: 600, color: "#64748b", lineHeight: 1.45 }}>{p.helperLine}</div>
      ) : null}
    </div>
  );
}
