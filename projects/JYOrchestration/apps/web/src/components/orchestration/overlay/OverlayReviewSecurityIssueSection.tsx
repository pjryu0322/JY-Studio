"use client";

/**
 * Harness Phase H6.5 — **Overlay Review/Security Issue Section**.
 *
 * Prompt Timeline Overlay 탭에서 "검토 결과가 어떤 조치 후보로 정리되는가"를 planning metadata로 표시한다.
 *
 * **read-only / planning only.** 실제 이슈 등록·머지 차단·조치 실행과 무관.
 */

import { uiTokens as t } from "@/components/ui/tokens";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import {
  buildReviewSecurityIssuePlanVM,
  type ReviewSecurityIssueCandidateVM,
  type ReviewSecurityIssueDuplicateGroupVM,
  type ReviewSecurityIssuePlanVM,
} from "@/lib/overlay-ui/reviewSecurityIssueUiAdapter";
import {
  OverlayUiBadge,
  OverlayUiEmptyHint,
  OverlayUiFindingList,
  OverlayUiKeyValueRow,
  OverlayUiRowCard,
  OverlayUiRowList,
  OverlayUiSection,
  OverlayUiSourceText,
} from "./OverlayUiPrimitives";

export function OverlayReviewSecurityIssueSection({
  overlay,
  defaultOpen,
}: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly defaultOpen?: boolean;
}) {
  const vm = buildReviewSecurityIssuePlanVM(
    overlay?.reviewSecurityIssuePlanningReport ?? null
  );
  return (
    <OverlayUiSection
      title="Review / Security Issue Plan"
      description={vm.disclaimer}
      defaultOpen={defaultOpen}
    >
      {!vm.hasData ? (
        <OverlayUiEmptyHint
          message="이번 턴에 대해 기록된 조치 후보 issue가 없습니다."
          secondary="checklist 또는 safety 진단 결과가 정리되면 자동으로 후보가 생성됩니다."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <PlanHeader vm={vm} />
          <OverlayUiFindingList
            findings={vm.findings}
            ariaLabel="Review/Security Issue 진단"
          />
          {vm.duplicateGroups.length > 0 && <DuplicateGroupList groups={vm.duplicateGroups} />}
          <OverlayUiRowList>
            {vm.issues.map((issue) => (
              <IssueRow key={issue.id} item={issue} />
            ))}
          </OverlayUiRowList>
        </div>
      )}
    </OverlayUiSection>
  );
}

function PlanHeader({ vm }: { readonly vm: ReviewSecurityIssuePlanVM }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <OverlayUiKeyValueRow
        label="총 issue 후보"
        value={`${vm.totalLabel} · ${vm.criticalCandidatesLabel}`}
      />
      <OverlayUiKeyValueRow
        label="영역 비중"
        value={`${vm.securityIssuesLabel}`}
      />
      <OverlayUiKeyValueRow
        label="상태 비중"
        value={`${vm.needsRemediationLabel} · ${vm.needsRecheckLabel}`}
      />
    </div>
  );
}

function DuplicateGroupList({
  groups,
}: {
  readonly groups: readonly ReviewSecurityIssueDuplicateGroupVM[];
}) {
  return (
    <div
      role="group"
      aria-label="중복 그룹 요약"
      style={{
        border: `1px dashed ${t.border}`,
        borderRadius: 8,
        padding: "6px 8px",
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 11, color: t.textMuted }}>중복 그룹:</span>
      {groups.map((g) => (
        <OverlayUiBadge key={g.key} tone="neutral" title={g.key}>
          {g.label} · {g.countLabel}
        </OverlayUiBadge>
      ))}
    </div>
  );
}

function IssueRow({ item }: { readonly item: ReviewSecurityIssueCandidateVM }) {
  return (
    <OverlayUiRowCard layout={{ gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <strong style={{ color: t.textPrimary }}>
          <OverlayUiSourceText source={item.title} />
        </strong>
        <OverlayUiBadge tone={item.areaTone} title="검토 영역">
          {item.areaLabel}
        </OverlayUiBadge>
        <OverlayUiBadge tone="neutral" title="검토 표준">
          {item.standardLabel}
        </OverlayUiBadge>
        <OverlayUiBadge tone={item.severityTone} title="severity">
          {item.severityLabel}
        </OverlayUiBadge>
        <OverlayUiBadge tone={item.statusTone} title="이슈 상태">
          {item.statusLabel}
        </OverlayUiBadge>
        <OverlayUiBadge tone={item.recommendedActionTone} title="권장 조치">
          {item.recommendedActionLabel}
        </OverlayUiBadge>
      </div>
      <div style={{ fontSize: 12, color: t.textPrimary, lineHeight: 1.5 }}>
        {item.description}
      </div>
      <div
        style={{
          fontSize: 11,
          color: t.textMuted,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span>조치 힌트: {item.remediationHint}</span>
        <span>중복 그룹: {item.duplicateGroupKey}</span>
        <span>출처 checklist: {item.sourceChecklistId}</span>
      </div>
    </OverlayUiRowCard>
  );
}
