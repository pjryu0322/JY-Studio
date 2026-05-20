"use client";

import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import type { AlternativeProposalPayloadWire } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1200,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const panelStyle: CSSProperties = {
  width: "min(720px, 100%)",
  maxHeight: "min(88vh, 900px)",
  overflow: "auto",
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
  padding: "20px 22px 18px",
};

const sectionTitle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 13,
  fontWeight: 700,
  color: "#334155",
  letterSpacing: "-0.01em",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

function ComparisonTable({
  baseline,
  alternative,
}: {
  readonly baseline: readonly string[];
  readonly alternative: readonly string[];
}) {
  const max = Math.max(baseline.length, alternative.length, 1);
  const rows = Array.from({ length: max }, (_, i) => ({
    base: baseline[i] ?? "—",
    alt: alternative[i] ?? "—",
  }));
  return (
    <table style={tableStyle}>
      <thead>
        <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
          <th style={{ padding: "6px 8px", color: "#64748b", fontWeight: 600 }}>기존</th>
          <th style={{ padding: "6px 8px", color: "#64748b", fontWeight: 600 }}>대안</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
            <td style={{ padding: "6px 8px", color: "#0f172a" }}>{row.base}</td>
            <td style={{ padding: "6px 8px", color: row.alt !== row.base ? "#0d9488" : "#0f172a" }}>{row.alt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OrderedList({ items }: { readonly items: readonly string[] }) {
  if (!items.length) return <div style={{ color: "#94a3b8", fontSize: 13 }}>(없음)</div>;
  return (
    <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
      {items.map((item, i) => (
        <li key={`${i}-${item}`}>{item}</li>
      ))}
    </ol>
  );
}

export type AlternativeProposalCanvasOverlayProps = Readonly<{
  open: boolean;
  payload: AlternativeProposalPayloadWire | null;
  onClose: () => void;
  onApplyAlternative: () => void;
  onKeepPrimary: () => void;
  onRegenerateAlternative: () => void;
  busy?: boolean;
}>;

export function AlternativeProposalCanvasOverlay({
  open,
  payload,
  onClose,
  onApplyAlternative,
  onKeepPrimary,
  onRegenerateAlternative,
  busy = false,
}: AlternativeProposalCanvasOverlayProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!open || !payload) return null;

  const altSteps = payload.steps.map((s) => s.title);
  const altActors = payload.actors.map((a) => a.name);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alternative-proposal-canvas-title"
      style={overlayStyle}
      onClick={onClose}
    >
      <div ref={panelRef} style={panelStyle} onClick={stopPropagation}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2 id="alternative-proposal-canvas-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
              대안 비교 Viewer
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>
              {payload.directionLabel ? `${payload.directionLabel} · ` : ""}
              기존안 vs 후보안 diff
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              borderRadius: 8,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            닫기
          </button>
        </div>

        <section style={{ marginTop: 18 }}>
          <h3 style={sectionTitle}>변경 요약</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: "#0f172a" }}>
            {payload.changeHighlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: 18 }}>
          <h3 style={sectionTitle}>액터 비교</h3>
          <ComparisonTable baseline={payload.comparison.baselineActors} alternative={altActors} />
        </section>

        <section style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <h3 style={sectionTitle}>기존안 흐름</h3>
            <OrderedList items={payload.comparison.baselineSteps} />
          </div>
          <div>
            <h3 style={sectionTitle}>대안 흐름</h3>
            <OrderedList items={altSteps} />
          </div>
        </section>

        {payload.rationale ? (
          <section style={{ marginTop: 18 }}>
            <h3 style={sectionTitle}>대안 방향</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#334155" }}>{payload.rationale}</p>
          </section>
        ) : null}

        <div
          style={{
            marginTop: 22,
            paddingTop: 16,
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={onApplyAlternative}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: "#0d9488",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            이 대안 적용
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onKeepPrimary}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#0f172a",
              fontSize: 13,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            기존안 유지
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onRegenerateAlternative}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              color: "#0f172a",
              fontSize: 13,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            다른 대안 생성
          </button>
        </div>
      </div>
    </div>
  );
}
