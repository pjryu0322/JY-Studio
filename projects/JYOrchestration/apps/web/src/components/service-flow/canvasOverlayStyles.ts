import type { CSSProperties } from "react";

export const canvasOverlayBackdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1200,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

export const canvasOverlayPanelStyle: CSSProperties = {
  width: "min(720px, 100%)",
  maxHeight: "min(88vh, 900px)",
  overflow: "auto",
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
  padding: "20px 22px 18px",
};

export const canvasSectionTitleStyle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 13,
  fontWeight: 700,
  color: "#334155",
  letterSpacing: "-0.01em",
};
