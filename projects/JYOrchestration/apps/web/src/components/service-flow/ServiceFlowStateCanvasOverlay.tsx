"use client";

import { useEffect, useCallback, type CSSProperties } from "react";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import {
  canvasOverlayBackdropStyle,
  canvasOverlayPanelStyle,
  canvasSectionTitleStyle,
} from "@/components/service-flow/canvasOverlayStyles";

function flowStepTitles(flow: RequirementsServiceFlowV1): string[] {
  return [...(flow.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => String(s.title ?? "").trim())
    .filter(Boolean);
}

function flowActorNames(flow: RequirementsServiceFlowV1): string[] {
  return (flow.actors ?? []).map((a) => a.name.trim()).filter(Boolean);
}

function OrderedList({ items }: { readonly items: readonly string[] }) {
  if (!items.length) {
    return <div style={{ color: "#94a3b8", fontSize: 13 }}>(없음)</div>;
  }
  return (
    <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
      {items.map((item, i) => (
        <li key={`${i}-${item}`}>{item}</li>
      ))}
    </ol>
  );
}

export function ServiceFlowStateCanvasOverlay({
  open,
  flow,
  title = "현재 서비스 흐름",
  subtitle = "확정·후보 상태의 현재 흐름",
  onClose,
}: {
  readonly open: boolean;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly title?: string;
  readonly subtitle?: string;
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

  if (!open || !flow) return null;

  const hydrated = hydrateServiceFlowStepsFromAlternativePayload(flow);
  const steps = flowStepTitles(hydrated);
  const actors = flowActorNames(hydrated);

  return (
    <CanvasPanel
      title={title}
      subtitle={subtitle}
      actors={actors}
      steps={steps}
      onClose={onClose}
      stopPropagation={stopPropagation}
    />
  );
}

function CanvasPanel({
  title,
  subtitle,
  actors,
  steps,
  onClose,
  stopPropagation,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly actors: readonly string[];
  readonly steps: readonly string[];
  readonly onClose: () => void;
  readonly stopPropagation: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-flow-state-canvas-title"
      style={canvasOverlayBackdropStyle}
      onClick={onClose}
    >
      <div style={canvasOverlayPanelStyle} onClick={stopPropagation}>
        <PanelHeader title={title} subtitle={subtitle} onClose={onClose} />
        <section style={{ marginTop: 18 }}>
          <h3 style={canvasSectionTitleStyle}>액터</h3>
          <OrderedList items={actors} />
        </section>
        <section style={{ marginTop: 18 }}>
          <h3 style={canvasSectionTitleStyle}>단계</h3>
          <OrderedList items={steps} />
        </section>
      </div>
    </div>
  );
}

function PanelHeader({
  title,
  subtitle,
  onClose,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly onClose: () => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <div>
        <h2 id="service-flow-state-canvas-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
          {title}
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>{subtitle}</p>
      </div>
      <button type="button" onClick={onClose} style={closeBtnStyle}>
        닫기
      </button>
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
