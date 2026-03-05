"use client";

import type { CSSProperties } from "react";

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SelectionOverlayProps {
  sections: Box[];
  others: Box[];
  draft: Pick<Box, "x" | "y" | "w" | "h"> | null;
  focusedId?: string | null;
}

function renderBox(
  box: Pick<Box, "x" | "y" | "w" | "h">,
  style: CSSProperties
) {
  return {
    position: "absolute" as const,
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
    ...style,
  };
}

export default function SelectionOverlay({
  sections,
  others,
  draft,
  focusedId,
}: SelectionOverlayProps) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {sections.map((box, i) => (
        <div
          key={box.id || `sec-${i}`}
          style={renderBox(box, {
            border:
              focusedId && focusedId === box.id
                ? "3px solid #0d47a1"
                : "2px solid #1a73e8",
            background:
              focusedId && focusedId === box.id
                ? "rgba(13,71,161,0.18)"
                : "rgba(26,115,232,0.12)",
          })}
        />
      ))}
      {others.map((box, i) => (
        <div
          key={box.id || `oth-${i}`}
          style={renderBox(box, {
            border:
              focusedId && focusedId === box.id
                ? "3px solid #2e7d32"
                : "2px solid #43a047",
            background:
              focusedId && focusedId === box.id
                ? "rgba(46,125,50,0.18)"
                : "rgba(67,160,71,0.10)",
          })}
        />
      ))}
      {draft && (
        <div
          style={renderBox(draft, {
            border: "2px dashed #333",
            background: "rgba(0,0,0,0.08)",
          })}
        />
      )}
    </div>
  );
}

