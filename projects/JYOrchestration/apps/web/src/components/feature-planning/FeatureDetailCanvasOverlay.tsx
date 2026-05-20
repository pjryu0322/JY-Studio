"use client";

import { useEffect, useCallback, type CSSProperties, type MouseEvent } from "react";
import {
  canConfirmFeatureDetailSlot,
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
  selectedSlotId,
  onClose,
  onEditSlot,
  onPartialSaveSlot,
  onConfirmSlot,
  onObsoleteSlot,
}: {
  readonly open: boolean;
  readonly artifact: FeatureDetailSlotsV1 | null;
  readonly selectedSlotId?: string | null;
  readonly onClose: () => void;
  readonly onEditSlot?: (slotId: string) => void;
  readonly onPartialSaveSlot?: (slotId: string) => void;
  readonly onConfirmSlot?: (slotId: string) => void;
  readonly onObsoleteSlot?: (slotId: string) => void;
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
  const hasActions = Boolean(onEditSlot || onPartialSaveSlot || onConfirmSlot || onObsoleteSlot);

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
          const selected = selectedSlotId === slot.id || artifact.focusFeatureId === slot.id;
          const confirmReady = canConfirmFeatureDetailSlot(slot);
          return (
            <section
              key={slot.id}
              style={{
                marginTop: 18,
                padding: selected ? "12px 14px" : undefined,
                borderRadius: selected ? 10 : undefined,
                border: selected ? "1px solid #cbd5e1" : undefined,
                background: selected ? "#f8fafc" : undefined,
              }}
            >
              <FeatureDetailSlotHeader
                slot={slot}
                hasActions={hasActions}
                confirmReady={confirmReady}
                onEditSlot={onEditSlot}
                onPartialSaveSlot={onPartialSaveSlot}
                onConfirmSlot={onConfirmSlot}
                onObsoleteSlot={onObsoleteSlot}
              />
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
  hasActions,
  confirmReady,
  onEditSlot,
  onPartialSaveSlot,
  onConfirmSlot,
  onObsoleteSlot,
}: {
  readonly slot: FeatureDetailSlot;
  readonly hasActions: boolean;
  readonly confirmReady: boolean;
  readonly onEditSlot?: (slotId: string) => void;
  readonly onPartialSaveSlot?: (slotId: string) => void;
  readonly onConfirmSlot?: (slotId: string) => void;
  readonly onObsoleteSlot?: (slotId: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ ...canvasSectionTitleStyle, marginBottom: 2 }}>{slot.title}</h3>
        <span style={{ fontSize: 11, color: "#64748b" }}>{STATUS_KO[slot.status] ?? slot.status}</span>
      </div>
      {hasActions ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {onEditSlot ? (
            <button type="button" style={miniBtnStyle} onClick={() => onEditSlot(slot.id)}>
              편집
            </button>
          ) : null}
          {onPartialSaveSlot ? (
            <button type="button" style={miniBtnStyle} onClick={() => onPartialSaveSlot(slot.id)}>
              부분 저장
            </button>
          ) : null}
          {onConfirmSlot ? (
            <button
              type="button"
              style={{ ...miniBtnStyle, ...(!confirmReady ? { opacity: 0.45, cursor: "not-allowed" } : {}) }}
              disabled={!confirmReady}
              onClick={() => onConfirmSlot(slot.id)}
            >
              확정
            </button>
          ) : null}
          {onObsoleteSlot ? (
            <button type="button" style={miniDangerBtnStyle} onClick={() => onObsoleteSlot(slot.id)}>
              폐기
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CanvasHeader({
  metrics,
  onClose,
}: {
  readonly metrics: ReturnType<typeof projectFeatureDetailMetrics>;
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

const miniBtnStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 8,
  padding: "4px 8px",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 700,
};

const miniDangerBtnStyle: CSSProperties = {
  ...miniBtnStyle,
  color: "#b91c1c",
  borderColor: "#fecaca",
};

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
