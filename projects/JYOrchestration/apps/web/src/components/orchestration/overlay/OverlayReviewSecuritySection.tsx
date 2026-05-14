"use client";

/**
 * Harness Phase H6 — **Overlay Review / Security Section**.
 *
 * Prompt Timeline Overlay 탭에서 "AI검수자/AI보안관이 어떤 기준으로 검토해야 하는가"를
 * planning metadata로 표시한다.
 *
 * **read-only / planning only.** 실제 보안 스캔·코드 리뷰·이슈 등록·머지 차단·PR 게이트와 무관.
 */

import { uiTokens as t } from "@/components/ui/tokens";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import {
  buildReviewSecurityPlanVM,
  type ReviewSecurityChecklistItemVM,
  type ReviewSecurityPlanVM,
} from "@/lib/overlay-ui/reviewSecurityUiAdapter";
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

export function OverlayReviewSecuritySection({
  overlay,
  defaultOpen,
}: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly defaultOpen?: boolean;
}) {
  const vm = buildReviewSecurityPlanVM(overlay?.reviewSecurityHarnessPlan ?? null);
  return (
    <OverlayUiSection
      title="Review / Security Plan"
      description={vm.disclaimer}
      defaultOpen={defaultOpen}
    >
      {!vm.hasData ? (
        <OverlayUiEmptyHint
          message="이번 턴에 대해 기록된 review/security checklist 후보가 없습니다."
          secondary="역할(예: AI검수자/AI보안관) 컨텍스트가 정리되면 자동으로 후보가 보강됩니다."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <PlanHeader vm={vm} />
          <OverlayUiFindingList findings={vm.findings} ariaLabel="Review/Security 진단" />
          <OverlayUiRowList>
            {vm.items.map((item) => (
              <ChecklistRow key={item.id} item={item} />
            ))}
          </OverlayUiRowList>
        </div>
      )}
    </OverlayUiSection>
  );
}

function PlanHeader({ vm }: { readonly vm: ReviewSecurityPlanVM }) {
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
      <OverlayUiKeyValueRow label="역할" value={vm.roleValue} />
      <OverlayUiKeyValueRow label="단계" value={vm.stageValue} />
      <OverlayUiKeyValueRow
        label="총 checklist"
        value={`${vm.totalLabel} · ${vm.criticalCandidatesLabel}`}
      />
      <OverlayUiKeyValueRow
        label="영역 분포"
        value={
          vm.areaBreakdown.length
            ? vm.areaBreakdown.map((b) => b.countLabel).join(" · ")
            : "후보 없음"
        }
      />
      <OverlayUiKeyValueRow
        label="검토 표준"
        value={vm.standardLabels.length ? vm.standardLabels.join(", ") : "표준 미지정"}
      />
    </div>
  );
}

function ChecklistRow({ item }: { readonly item: ReviewSecurityChecklistItemVM }) {
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
        <span>대상 역할: {item.appliesToRole}</span>
        <span>사유: {item.reasonLabel}</span>
      </div>
    </OverlayUiRowCard>
  );
}
