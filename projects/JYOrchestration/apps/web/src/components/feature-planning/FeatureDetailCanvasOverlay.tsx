"use client";

import { useEffect, useCallback, type CSSProperties } from "react";
import {
  projectFeatureDetailMetrics,
  type FeatureDetailSlot,
  type FeatureDetailSlotsV1,
} from "@/lib/requirements/featureDetailSlots";
import {
  canvasOverlayBackdropStyle,
  canvasOverlayPanelStyle,
  canvasSectionTitleStyle,
} from "@/components/service-flow/canvasOverlayStyles";

const STATUS_KO: Record<string, string> = {
  candidate: "후보",
  partial: "부분 확정",
  confirmed: "확정",
  obsolete: "폐기",
};

function listBlock(label: string, items: readonly string[] | undefined): string | null {
  if (!items?.length) return null;
  return `${label}:\n${items.map((x) => `- ${x}`).join("\n")}`;
}

function slotBody(slot: FeatureDetailSlot): string {
  const parts = [
    slot.description ? `설명: ${slot.description}` : null,
    listBlock("입력 데이터", slot.inputData),
    listBlock("처리 규칙", slot.processRules),
    listBlock("출력 결과", slot.outputData),
    listBlock("예외 상황", slot.exceptionCases),
    slot.relatedActors?.length ? `관련 액터: ${slot.relatedActors.join(", ")}` : null,
    `상태: ${STATUS_KO[slot.status] ?? slot.status}`,
    `연결 단계: ${slot.linkedStepId}`,
  ].filter(Boolean);
  return parts.join("\n\n") || "(상세 없음)";
}

export function FeatureDetailCanvasOverlay({
  open,
  artifact,
  onClose,
}: {
  readonly open: boolean;
  readonly artifact: FeatureDetailSlotsV1 | null;
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

  if (!open || !artifact?.slots?.length) return null;

  const metrics = projectFeatureDetailMetrics(artifact);
  const slots = artifact.slots.filter((s) => s.status !== "obsolete");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-detail-canvas-title"
      style={canvasOverlayBackdropStyle}
      onClick={onClose}
    >
      <div style={canvasOverlayPanelStyle} onClick={stopPropagation}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2 id="feature-detail-canvas-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
              세부 기능 정의
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>
              후보 {metrics.featureCount} · 확정 {metrics.confirmedFeatureCount} · 진행률{" "}
              {Math.round(metrics.featureCoverage * 100)}%
            </p>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle}>
            닫기
          </button>
        </div>
        {slots.map((slot) => (
          <section key={slot.id} style={{ marginTop: 18 }}>
            <h3 style={canvasSectionTitleStyle}>{slot.title}</h3>
            <p style={bodyStyle}>{slotBody(slot)}</p>
          </section>
        ))}
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

const bodyStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.6,
  color: "#334155",
  whiteSpace: "pre-wrap",
};
