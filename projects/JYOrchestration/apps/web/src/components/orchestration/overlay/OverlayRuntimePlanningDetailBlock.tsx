"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiEmptyHint } from "./OverlayUiPrimitives";

const OVERLAY_RUNTIME_PLANNING_ROW_LIST_STYLE = {
  margin: 0,
  paddingLeft: 18,
  fontSize: 11,
  color: t.textMuted,
  lineHeight: 1.45,
  overflowWrap: "anywhere" as const,
} as const;

/** H35+ runtime planning harness 섹션 공통 title·row list·empty hint 블록. */
export function OverlayRuntimePlanningDetailBlock({
  title,
  rows,
  emptyHint,
}: {
  readonly title: string;
  readonly rows: readonly string[];
  readonly emptyHint: string;
}) {
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>{title}</div>
      {rows.length > 0 ? (
        <ul style={OVERLAY_RUNTIME_PLANNING_ROW_LIST_STYLE}>
          {rows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      ) : (
        <OverlayUiEmptyHint message={emptyHint} />
      )}
    </>
  );
}
