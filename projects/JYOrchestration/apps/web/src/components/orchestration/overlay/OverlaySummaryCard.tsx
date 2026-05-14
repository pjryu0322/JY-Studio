"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayUiViewModel } from "@/lib/overlay-ui/overlayUiAdapter";
import { OVERLAY_UI_EMPTY_STATE_MESSAGE } from "@/lib/overlay-ui/overlayUiDescription";
import { OverlayContextSection } from "./OverlayContextSection";
import { OverlayBudgetSection } from "./OverlayBudgetSection";
import { OverlayWarningSection } from "./OverlayWarningSection";
import { OverlayAssemblyPlanSection } from "./OverlayAssemblyPlanSection";
import { OverlayPruningSection } from "./OverlayPruningSection";
import { OverlayUiBadge, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlaySummaryCard({
  overlay,
}: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
}) {
  const vm = buildOverlayUiViewModel(overlay);
  if (!vm.hasOverlayData) {
    return <OverlayUiEmptyHint message={OVERLAY_UI_EMPTY_STATE_MESSAGE} />;
  }
  const snapshot = vm.snapshot;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          padding: "6px 10px",
          background: "#f1f5f9",
          border: `1px solid ${t.border}`,
          borderRadius: 8,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, color: t.textMuted }}>Overlay 요약</span>
        <OverlayUiBadge tone={snapshot.overflowRiskTone} title="토큰 예산 과부하 위험(휴리스틱)">
          위험 {snapshot.overflowRiskLabel}
        </OverlayUiBadge>
        {snapshot.conflictCount > 0 ? (
          <OverlayUiBadge tone="warning" title="설계 방향 충돌 가능성">
            충돌 {snapshot.conflictCount}
          </OverlayUiBadge>
        ) : null}
        {snapshot.driftCount > 0 ? (
          <OverlayUiBadge tone="warning" title="정책 정렬 이슈">
            정책 {snapshot.driftCount}
          </OverlayUiBadge>
        ) : null}
        {snapshot.requiredContextsCount > 0 ? (
          <OverlayUiBadge tone="info" title="핵심 컨텍스트(계획)">
            핵심 {snapshot.requiredContextsCount}
          </OverlayUiBadge>
        ) : null}
        {snapshot.excludeCandidatesCount > 0 ? (
          <OverlayUiBadge tone="warning" title="축소 후보(계획)">
            축소 {snapshot.excludeCandidatesCount}
          </OverlayUiBadge>
        ) : null}
      </div>
      <OverlayContextSection vm={vm.context} />
      <OverlayBudgetSection vm={vm.budget} />
      <OverlayWarningSection vm={vm.warning} />
      <OverlayAssemblyPlanSection vm={vm.assemblyPlan} />
      <OverlayPruningSection vm={vm.pruning} />
    </div>
  );
}
