"use client";

import type { CSSProperties } from "react";

const badgeStyle: CSSProperties = {
  position: "absolute",
  top: -4,
  right: -4,
  minWidth: 16,
  height: 16,
  padding: "0 4px",
  borderRadius: 999,
  background: "#0d9488",
  color: "#fff",
  fontSize: 10,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  border: "2px solid rgba(255,255,255,0.92)",
  boxSizing: "border-box",
};

export function ProjectRailCountBadge({ count }: { readonly count: number }) {
  if (count <= 0) return null;
  return (
    <span aria-hidden style={badgeStyle}>
      {count > 9 ? "9+" : count}
    </span>
  );
}
