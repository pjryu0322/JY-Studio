"use client";

import { useEffect, useCallback, type CSSProperties } from "react";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import {
  canvasOverlayBackdropStyle,
  canvasOverlayPanelStyle,
  canvasSectionTitleStyle,
} from "@/components/service-flow/canvasOverlayStyles";

export function FeatureDefinitionCanvasOverlay({
  open,
  artifact,
  onClose,
}: {
  readonly open: boolean;
  readonly artifact: FeaturePlanningSlotsArtifactV1 | null;
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

  const slots = artifact.slots.filter((s) => !s.legacy);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-definition-canvas-title"
      style={canvasOverlayBackdropStyle}
      onClick={onClose}
    >
      <div style={canvasOverlayPanelStyle} onClick={stopPropagation}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2 id="feature-definition-canvas-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
              기능 정의
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>기능 기획 슬롯 상태</p>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle}>
            닫기
          </button>
        </div>
        {slots.map((slot) => (
          <section key={slot.slotKey} style={{ marginTop: 18 }}>
            <h3 style={canvasSectionTitleStyle}>{slot.slotName}</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#334155", whiteSpace: "pre-wrap" }}>
              {slot.slotDescription ?? slot.reason ?? "(설명 없음)"}
            </p>
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
