"use client";

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayUiViewModel } from "@/lib/overlay-ui/overlayUiAdapter";
import {
  OVERLAY_UI_EMPTY_STATE_HINT,
  OVERLAY_UI_EMPTY_STATE_MESSAGE,
} from "@/lib/overlay-ui/overlayUiDescription";
import { OverlayContextSection } from "./OverlayContextSection";
import { OverlayBudgetSection } from "./OverlayBudgetSection";
import { OverlayWarningSection } from "./OverlayWarningSection";
import { OverlayAssemblyPlanSection } from "./OverlayAssemblyPlanSection";
import { OverlayPruningSection } from "./OverlayPruningSection";
import { OverlaySummaryHeader } from "./OverlaySummaryHeader";
import { OverlayUiEmptyHint } from "./OverlayUiPrimitives";

/**
 * Overlay 탭 진입점 카드.
 *
 * - empty 상태(no metadata): empty hint + 보조 안내.
 * - 그 외: 상단 `OverlaySummaryHeader` + 5개 섹션.
 * - 섹션 default 펼침/접힘은 adapter `sectionDefaults`(단일 출처)에서 결정.
 *
 * 이전 단계까지 존재했던 별도 `SnapshotStrip`은 SummaryHeader와 정보가 중복되어
 * Phase 1.5 리팩토링에서 제거되었다(요약은 SummaryHeader 단일 위치).
 */
export function OverlaySummaryCard({
  overlay,
}: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
}) {
  const vm = buildOverlayUiViewModel(overlay);
  if (!vm.hasOverlayData) {
    return (
      <OverlayUiEmptyHint
        message={OVERLAY_UI_EMPTY_STATE_MESSAGE}
        secondary={OVERLAY_UI_EMPTY_STATE_HINT}
      />
    );
  }
  const { sectionDefaults: d } = vm;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <OverlaySummaryHeader vm={vm.summary} />
      <OverlayContextSection vm={vm.context} defaultOpen={d.context} />
      <OverlayBudgetSection vm={vm.budget} defaultOpen={d.budget} />
      <OverlayWarningSection vm={vm.warning} defaultOpen={d.warning} />
      <OverlayAssemblyPlanSection vm={vm.assemblyPlan} defaultOpen={d.assemblyPlan} />
      <OverlayPruningSection vm={vm.pruning} defaultOpen={d.pruning} />
    </div>
  );
}
