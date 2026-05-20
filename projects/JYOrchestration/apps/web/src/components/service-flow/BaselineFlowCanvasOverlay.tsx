"use client";

import { useEffect, useCallback, type CSSProperties } from "react";
import type { AlternativeProposalPayloadWire } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  canvasOverlayBackdropStyle,
  canvasOverlayPanelStyle,
  canvasSectionTitleStyle,
} from "@/components/service-flow/canvasOverlayStyles";

function stepTitles(flow: RequirementsServiceFlowV1): string[] {
  return [...(flow.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => String(s.title ?? "").trim())
    .filter(Boolean);
}

function actorNames(flow: RequirementsServiceFlowV1): string[] {
  return (flow.actors ?? []).map((a) => a.name.trim()).filter(Boolean);
}

function BulletList({ items }: { readonly items: readonly string[] }) {
  if (!items.length) {
    return <div style={{ color: "#94a3b8", fontSize: 13 }}>(없음)</div>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55, color: "#0f172a" }}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function BaselineFlowCanvasOverlay({
  open,
  payload,
  onClose,
}: {
  readonly open: boolean;
  readonly payload: AlternativeProposalPayloadWire | null;
  readonly onClose: () => void;
}) {
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

  if (!open || !payload?.baselineFlow) return null;

  const baseline = payload.baselineFlow;
  const comp = payload.comparison;

  const diffLines = [
    ...comp.addedSteps.map((s) => `+ 단계: ${s}`),
    ...comp.removedSteps.map((s) => `- 단계: ${s}`),
    ...comp.changedSteps.map((s) => `~ 단계: ${s}`),
    ...comp.addedActors.map((a) => `+ 액터: ${a}`),
    ...comp.removedActors.map((a) => `- 액터: ${a}`),
  ];

  return (
    <BaselinePanel
      stopPropagation={stopPropagation}
      onClose={onClose}
      baseline={baseline}
      diffLines={diffLines}
    />
  );
}

function BaselinePanel({
  stopPropagation,
  onClose,
  baseline,
  diffLines,
}: {
  readonly stopPropagation: (e: React.MouseEvent) => void;
  readonly onClose: () => void;
  readonly baseline: RequirementsServiceFlowV1;
  readonly diffLines: readonly string[];
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="baseline-flow-canvas-title"
      style={canvasOverlayBackdropStyle}
      onClick={onClose}
    >
      <div style={canvasOverlayPanelStyle} onClick={stopPropagation}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2 id="baseline-flow-canvas-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
              기준안 (비교 기준)
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>후보안 대비 기존 확정 흐름</p>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle}>
            닫기
          </button>
        </div>
        <section style={{ marginTop: 18 }}>
          <h3 style={canvasSectionTitleStyle}>기준 액터</h3>
          <BulletList items={actorNames(baseline)} />
        </section>
        <section style={{ marginTop: 18 }}>
          <h3 style={canvasSectionTitleStyle}>기준 단계</h3>
          <BulletList items={stepTitles(baseline)} />
        </section>
        {diffLines.length ? (
          <section style={{ marginTop: 18 }}>
            <h3 style={canvasSectionTitleStyle}>후보안 대비 변경 요약</h3>
            <BulletList items={diffLines} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

const closeBtnStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 8,
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: 13,
};
