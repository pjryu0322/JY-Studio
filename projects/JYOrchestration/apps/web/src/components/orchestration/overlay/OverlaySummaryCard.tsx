"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import {
  buildOverlayUiViewModel,
  type OverlayUiTimelineSnapshotVM,
} from "@/lib/overlay-ui/overlayUiAdapter";
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
import { OverlayUiBadge, OverlayUiEmptyHint } from "./OverlayUiPrimitives";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";

type SnapshotBadge = Readonly<{
  key: string;
  label: string;
  count: number;
  tone: OverlayUiBadgeTone;
  title: string;
}>;

/** 위험 라벨이 결측("ㅡ")이면 0으로 취급하여 뱃지를 숨긴다. */
function hasOverflowRiskBadge(label: string): boolean {
  const normalized = label.trim();
  return normalized.length > 0 && normalized !== "ㅡ";
}

function buildSnapshotBadges(s: OverlayUiTimelineSnapshotVM): readonly SnapshotBadge[] {
  return [
    {
      key: "risk",
      label: `위험 ${s.overflowRiskLabel}`,
      count: hasOverflowRiskBadge(s.overflowRiskLabel) ? 1 : 0,
      tone: s.overflowRiskTone,
      title: "토큰 예산 과부하 위험(휴리스틱)",
    },
    {
      key: "conflict",
      label: `충돌 ${s.conflictCount}`,
      count: s.conflictCount,
      tone: "warning",
      title: "설계 방향 충돌 가능성",
    },
    {
      key: "drift",
      label: `정책 ${s.driftCount}`,
      count: s.driftCount,
      tone: "warning",
      title: "정책 정렬 이슈",
    },
    {
      key: "required",
      label: `핵심 ${s.requiredContextsCount}`,
      count: s.requiredContextsCount,
      tone: "info",
      title: "핵심 컨텍스트(계획)",
    },
    {
      key: "exclude",
      label: `축소 ${s.excludeCandidatesCount}`,
      count: s.excludeCandidatesCount,
      tone: "warning",
      title: "축소 후보(계획)",
    },
  ];
}

function SnapshotStrip({ snapshot }: { readonly snapshot: OverlayUiTimelineSnapshotVM }) {
  const badges = buildSnapshotBadges(snapshot);
  return (
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
      {badges.map((b) =>
        b.count > 0 ? (
          <OverlayUiBadge key={b.key} tone={b.tone} title={b.title}>
            {b.label}
          </OverlayUiBadge>
        ) : null
      )}
    </div>
  );
}

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
  /**
   * 섹션 기본 펼침 정책(Phase 1.5):
   * - 컨텍스트(역할/판단): 펼침
   * - 맥락 예산: 펼침
   * - 경고: warning이 있을 때 펼침
   * - 조립 계획: 접힘(데이터 많을 수 있어 mobile 과밀 방지)
   * - 축소 후보: 후보가 있을 때 펼침
   */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <OverlaySummaryHeader vm={vm.summary} />
      <SnapshotStrip snapshot={vm.snapshot} />
      <OverlayContextSection vm={vm.context} defaultOpen />
      <OverlayBudgetSection vm={vm.budget} defaultOpen />
      <OverlayWarningSection vm={vm.warning} defaultOpen={vm.warning.hasData} />
      <OverlayAssemblyPlanSection vm={vm.assemblyPlan} defaultOpen={false} />
      <OverlayPruningSection vm={vm.pruning} defaultOpen={vm.pruning.hasData} />
    </div>
  );
}
