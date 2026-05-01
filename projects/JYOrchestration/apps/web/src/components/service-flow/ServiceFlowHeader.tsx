"use client";

const headerMetricBadgeLabel = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  letterSpacing: "0.01em",
} as const;

function ExpandIcon({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      {expanded ? (
        <>
          <path d="M9 3H5a2 2 0 0 0-2 2v4" />
          <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
          <path d="M3 9l7-7" />
          <path d="M21 15l-7 7" />
        </>
      ) : (
        <>
          <path d="M15 3h4a2 2 0 0 1 2 2v4" />
          <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
          <path d="M21 9l-7-7" />
          <path d="M3 15l7 7" />
        </>
      )}
    </svg>
  );
}

export function ServiceFlowHeader(p: {
  readonly title: string;
  readonly subtitle: string;
  readonly progressPercent: number;
  readonly remainingRequiredCount: number;
  readonly onOpenRemaining: () => void;
  readonly chatExpanded: boolean;
  readonly onToggleExpand: () => void;
  readonly hint?: string | null;
}) {
  return (
    <div
      style={{
        flex: "0 0 auto",
        padding: "10px 20px 8px",
        position: "sticky",
        top: 0,
        zIndex: 6,
        background: "rgba(248,250,252,0.96)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(226,232,240,0.75)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: 12,
          width: "100%",
          minWidth: 0,
        }}
      >
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em", lineHeight: 1.25 }}>{p.title}</div>
          <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 600, color: "#64748b", lineHeight: 1.45 }}>{p.subtitle}</div>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "nowrap",
            alignItems: "center",
            gap: 10,
            marginLeft: "auto",
            minWidth: 0,
            overflowX: "auto",
            overscrollBehaviorX: "contain",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "nowrap",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: 1.35,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            <span title={p.hint ?? undefined}>
              <span style={headerMetricBadgeLabel}>설계 완성도</span>{" "}
              <span style={{ fontWeight: 900, fontSize: 15 }}>{p.progressPercent}%</span>
            </span>
            <span style={{ color: "#cbd5e1", fontWeight: 500 }} aria-hidden>
              |
            </span>
            {p.remainingRequiredCount > 0 ? (
              <button
                type="button"
                onClick={() => p.onOpenRemaining()}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  margin: 0,
                  cursor: "pointer",
                  font: "inherit",
                  color: "inherit",
                  textAlign: "left",
                }}
              >
                <span style={headerMetricBadgeLabel}>남은 결정사항</span>{" "}
                <span style={{ fontWeight: 900, fontSize: 15, color: "#0369a1" }}>{p.remainingRequiredCount}개</span>
              </button>
            ) : (
              <span>
                <span style={headerMetricBadgeLabel}>남은 결정사항</span>{" "}
                <span style={{ fontWeight: 900, fontSize: 15 }}>0개</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => p.onToggleExpand()}
            aria-label={p.chatExpanded ? "채팅 축소" : "채팅 확대"}
            title={p.chatExpanded ? "채팅 축소" : "채팅 확대"}
            style={{
              border: "1px solid #cbd5e1",
              background: p.chatExpanded ? "#f0fdfa" : "#fff",
              borderRadius: 10,
              width: 36,
              height: 36,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0f172a",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <ExpandIcon expanded={p.chatExpanded} />
          </button>
        </div>
      </div>
    </div>
  );
}
