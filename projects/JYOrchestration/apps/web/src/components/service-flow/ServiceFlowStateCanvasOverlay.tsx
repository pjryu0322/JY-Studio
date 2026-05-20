"use client";

import { useEffect, useCallback } from "react";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import {
  buildActorRelatedStepViews,
  buildStepActorAssignmentViews,
  formatStepActorAssignmentLine,
  isCandidateActor,
} from "@/lib/requirements/serviceFlowActorStepMapping";
import {
  canvasOverlayBackdropStyle,
  canvasOverlayPanelStyle,
  canvasSectionTitleStyle,
} from "@/components/service-flow/canvasOverlayStyles";

function OrderedList({ items }: { readonly items: readonly string[] }) {
  if (!items.length) {
    return <EmptyBlock />;
  }
  return (
    <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
      {items.map((item, i) => (
        <li key={`${i}-${item}`}>{item}</li>
      ))}
    </ol>
  );
}

function EmptyBlock() {
  return <div style={{ color: "#94a3b8", fontSize: 13 }}>(없음)</div>;
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
  const stepLines = buildStepActorAssignmentViews(hydrated).map(formatStepActorAssignmentLine);

  const actorLines = (hydrated.actors ?? []).map((actor) => {
    const related = buildActorRelatedStepViews(hydrated, actor.id);
    const roleLabel = isCandidateActor(actor) ? "후보" : "확정";
    const steps =
      related.length > 0
        ? related
            .map((r) => {
              const role = r.role === "primary" ? "주" : r.role === "secondary" ? "보조" : "후보";
              return `${r.stepTitle}(${role})`;
            })
            .join(", ")
        : "(연결 단계 없음)";
    return `${actor.name} [${roleLabel}] — ${steps}`;
  });

  return (
    <FlowCanvasDialog
      title={title}
      subtitle={subtitle}
      stepLines={stepLines}
      actorLines={actorLines}
      onClose={onClose}
      stopPropagation={stopPropagation}
    />
  );
}

function FlowCanvasDialog({
  title,
  subtitle,
  stepLines,
  actorLines,
  onClose,
  stopPropagation,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly stepLines: readonly string[];
  readonly actorLines: readonly string[];
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
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2
              id="service-flow-state-canvas-title"
              style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}
            >
              {title}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>{subtitle}</p>
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
              flexShrink: 0,
            }}
          >
            닫기
          </button>
        </header>
        <section style={{ marginTop: 18 }}>
          <h3 style={canvasSectionTitleStyle}>단계별 담당 (주·보조·후보)</h3>
          <OrderedList items={stepLines} />
        </section>
        <section style={{ marginTop: 18 }}>
          <h3 style={canvasSectionTitleStyle}>액터별 관련 단계</h3>
          <OrderedList items={actorLines} />
        </section>
      </div>
    </div>
  );
}
