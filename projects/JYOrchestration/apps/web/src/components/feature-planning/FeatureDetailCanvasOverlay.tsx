"use client";

import { useEffect, useCallback, type CSSProperties, type MouseEvent } from "react";
import {
  projectFeatureDetailMetrics,
  type FeatureDetailProjectionMetrics,
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
  selectedSlotId,
  onClose,
  onEditSlot,
}: {
  readonly open: boolean;
  readonly artifact: FeatureDetailSlotsV1 | null;
  readonly selectedSlotId?: string | null;
  readonly onClose: () => void;
  readonly onEditSlot?: (slotId: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const stopPropagation = useCallback((e: MouseEvent) => {
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
        <CanvasHeader metrics={metrics} onClose={onClose} />
        {slots.map((slot) => {
          const selected = selectedSlotId === slot.id;
          return (
            <section key={slot.id} style={{ marginTop: 18 }}>
              <FeatureDetailSlotHeader slot={slot} selected={selected} onEditSlot={onEditSlot} />
              <p style={bodyStyle}>{slotBody(slot)}</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function FeatureDetailSlotHeader({
  slot,
  selected,
  onEditSlot,
}: {
  readonly slot: FeatureDetailSlot;
  readonly selected: boolean;
  readonly onEditSlot?: (slotId: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <h3 style={canvasSectionTitleStyle}>{slot.title}</h3>
      {onEditSlot ? (
        <button type="button" style={editBtnStyle(selected)} onClick={() => onEditSlot(slot.id)}>
          편집
        </button>
      ) : null}
    </div>
  );
}

function CanvasHeader({
  metrics,
  onClose,
}: {
  readonly metrics: FeatureDetailProjectionMetrics;
  readonly onClose: () => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <div>
        <h2 id="feature-detail-canvas-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
          세부 기능 정의
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>
          후보 {metrics.candidateFeatureCount} · 부분 {metrics.partialFeatureCount} · 확정{" "}
          {metrics.confirmedFeatureCount}/{metrics.featureCount} · 진행률 {Math.round(metrics.featureCoverage * 100)}%
        </p>
      </div>
      <button type="button" onClick={onClose} style={closeBtnStyle}>
        닫기
      </button>
    </div>
  );
}

function editBtnStyle(selected: boolean): CSSProperties {
  return {
    border: selected ? "1px solid #0f172a" : "1px solid #e2e8f0",
    background: selected ? "#f1f5f9" : "#f8fafc",
    borderRadius: 8,
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  };
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
