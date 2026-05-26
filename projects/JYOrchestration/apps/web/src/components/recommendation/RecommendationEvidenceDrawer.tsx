"use client";

import { useEffect } from "react";
import { RecommendationEvidencePanel } from "@/components/recommendation/RecommendationEvidencePanel";
import type { RecommendationEvidenceItem } from "@/lib/recommendation/recommendationEvidence";

const backdropStyle = {
  position: "fixed" as const,
  inset: 0,
  zIndex: 1150,
  background: "rgba(15, 23, 42, 0.4)",
};

const panelStyle = {
  position: "fixed" as const,
  top: 0,
  right: 0,
  zIndex: 1160,
  width: "min(520px, 100vw)",
  height: "100%",
  background: "#fff",
  borderLeft: "1px solid #e2e8f0",
  boxShadow: "-8px 0 32px rgba(15, 23, 42, 0.12)",
  display: "flex",
  flexDirection: "column" as const,
};

export function RecommendationEvidenceDrawer({
  open,
  items,
  onClose,
  closeOnEscape = true,
}: {
  readonly open: boolean;
  readonly items: readonly RecommendationEvidenceItem[];
  readonly onClose: () => void;
  readonly closeOnEscape?: boolean;
}) {
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  return (
    <>
      <div style={backdropStyle} role="presentation" onClick={onClose} />
      <aside style={panelStyle} aria-label="AI 추천근거">
        <RecommendationEvidencePanel items={items} onClose={onClose} />
      </aside>
    </>
  );
}
