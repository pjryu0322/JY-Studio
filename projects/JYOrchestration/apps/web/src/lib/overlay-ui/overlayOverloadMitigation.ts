/**
 * H9.5 — Overlay **과밀 완화** 진단(read-only). 기존 `overlayRenderingBudget` 상수와 정렬.
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import {
  OVERLAY_MAX_VISIBLE_ADVANCED_SECTIONS,
  OVERLAY_MAX_VISIBLE_FINDINGS,
  OVERLAY_MAX_VISIBLE_WARNING_GROUPS,
} from "@/lib/overlay-ui/overlayRenderingBudget";
import { countOverlayHarnessPlanningBlocks } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";

export type OverlayOverloadRiskLevel = "low" | "medium" | "high";

export function overlayOverloadRiskLabelKo(risk: OverlayOverloadRiskLevel): string {
  if (risk === "high") return "높음";
  if (risk === "medium") return "중간";
  return "낮음";
}

export type OverlayOverloadSummary = Readonly<{
  maxAdvancedSections: number;
  maxWarningGroups: number;
  maxVisibleFindings: number;
  estimatedHarnessPlanningBlocks: number;
  /** narrow+compact 시 advanced DOM 생략 등으로 가정되는 과밀 완화 수준. */
  overlayOverloadRisk: OverlayOverloadRiskLevel;
  /** 사용자에게 보여줄 수 있는 완화 힌트 문구. */
  mitigationHints: readonly string[];
}>;

export function summarizeOverlayOverloadMitigation(input: {
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  /** SummaryCard 등에서 compact+narrow 여부(진단에서는 보통 false). */
  readonly compactAndNarrowUi?: boolean;
}): OverlayOverloadSummary {
  const blocks = countOverlayHarnessPlanningBlocks(input.extract);
  const hints: string[] = [
    `고급 Harness 섹션 동시 표시 상한 ${OVERLAY_MAX_VISIBLE_ADVANCED_SECTIONS}개`,
    `경고 그룹 상한 ${OVERLAY_MAX_VISIBLE_WARNING_GROUPS}개`,
    `finding 리스트 행 상한 ${OVERLAY_MAX_VISIBLE_FINDINGS}개`,
  ];

  let risk: OverlayOverloadRiskLevel = "low";
  if (blocks > 8 || (input.extract?.overlayPruningCandidates?.length ?? 0) > 6) risk = "high";
  else if (blocks > 5) risk = "medium";

  if (input.compactAndNarrowUi) {
    hints.push("compact+narrow 모드에서 advanced 섹션 일부 DOM 생략");
    if (risk === "low") risk = "medium";
  }

  return {
    maxAdvancedSections: OVERLAY_MAX_VISIBLE_ADVANCED_SECTIONS,
    maxWarningGroups: OVERLAY_MAX_VISIBLE_WARNING_GROUPS,
    maxVisibleFindings: OVERLAY_MAX_VISIBLE_FINDINGS,
    estimatedHarnessPlanningBlocks: blocks,
    overlayOverloadRisk: risk,
    mitigationHints: hints,
  };
}
