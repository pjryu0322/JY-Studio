"use client";

import { useEffect, useCallback } from "react";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import {
  buildActorRelatedStepViews,
  buildStepActorAssignmentViews,
  formatStepActorAssignmentLine,
} from "@/lib/requirements/serviceFlowActorStepMapping";
import { actorStatusDisplayLabel, normalizeActorStatus } from "@/lib/requirements/serviceFlowActorAssignment";
import {
  canvasOverlayBackdropStyle,
  canvasOverlayPanelStyle,
  canvasSectionTitleStyle,
} from "@/components/service-flow/canvasOverlayStyles";

export function ServiceFlowStateCanvasOverlay({
  open,
  flow,
  title = "현재 서비스 흐름",
  subtitle = "확정·후보 상태의 현재 흐름",
  onClose,
  onManageStepAssignment,
}: {
  readonly open: boolean;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly title?: string;
  readonly subtitle?: string;
  readonly onClose: () => void;
  readonly onManageStepAssignment?: (stepId: string) => void;
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
  const stepViews = buildStepActorAssignmentViews(hydrated);

  const actorLines = (hydrated.actors ?? []).map((actor) => {
    const related = buildActorRelatedStepViews(hydrated, actor.id);
    const st = normalizeActorStatus(actor);
    const steps =
      related.length > 0
        ? related
            .map((r) => {
              const role =
                r.role === "primary"
                  ? "주"
                  : r.role === "secondary"
                    ? "보조"
                    : r.role === "partial"
                      ? "부분"
                      : "후보";
              return `${r.stepTitle}(${role})`;
            })
            .join(", ")
        : "(연결 단계 없음)";
    return `${actor.name} [${actorStatusDisplayLabel(st)}] — ${steps}`;
  });

  return (
    <FlowCanvasBody
      title={title}
      subtitle={subtitle}
      stepViews={stepViews}
      actorLines={actorLines}
      onClose={onClose}
      stopPropagation={stopPropagation}
      onManageStepAssignment={onManageStepAssignment}
    />
  );
}

function FlowCanvasBody({
  title,
  subtitle,
  stepViews,
  actorLines,
  onClose,
  stopPropagation,
  onManageStepAssignment,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly stepViews: ReturnType<typeof buildStepActorAssignmentViews>;
  readonly actorLines: readonly string[];
  readonly onClose: () => void;
  readonly stopPropagation: (e: React.MouseEvent) => void;
  readonly onManageStepAssignment?: (stepId: string) => void;
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
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
            {stepViews.map((view) => (
              <li key={view.stepId} style={{ marginBottom: 8 }}>
                <div>{formatStepActorAssignmentLine(view)}</div>
                {onManageStepAssignment ? (
                  <button
                    type="button"
                    onClick={() => onManageStepAssignment(view.stepId)}
                    style={{
                      marginTop: 4,
                      padding: "2px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      cursor: "pointer",
                    }}
                  >
                    담당 변경
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
        <section style={{ marginTop: 18 }}>
          <h3 style={canvasSectionTitleStyle}>액터별 관련 단계</h3>
          {actorLines.length ? (
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
              {actorLines.map((line, i) => (
                <li key={`${i}-${line}`}>{line}</li>
              ))}
            </ol>
          ) : (
            <div style={{ color: "#94a3b8", fontSize: 13 }}>(없음)</div>
          )}
        </section>
      </div>
    </div>
  );
}
