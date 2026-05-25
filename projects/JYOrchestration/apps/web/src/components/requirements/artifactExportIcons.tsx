"use client";

import type { CSSProperties } from "react";

export const artifactExportIconButtonStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  borderRadius: 8,
  width: 34,
  height: 34,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#0f172a",
  padding: 0,
};

export function DocExportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h2" />
      <path d="M8 17h8" />
      <path d="M14 13h2" />
    </svg>
  );
}

export function PdfExportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M7 14h3v4H7z" />
      <path d="M13 14h4v4h-4z" />
      <path d="M7 10h10" />
    </svg>
  );
}
