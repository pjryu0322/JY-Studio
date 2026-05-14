"use client";

/**
 * Harness Phase H6.5 — **Overlay Remediation Loop Section**.
 *
 * Prompt Timeline Overlay 탭에서 "검토 → 조치 → 재점검" loop를 dry-run plan으로 표시한다.
 *
 * **read-only / planning only.** 실제 task 생성·assignment·Cursor 실행·머지 차단과 무관.
 */

import { uiTokens as t } from "@/components/ui/tokens";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import {
  buildRemediationLoopPlanVM,
  type RemediationLoopPlanVM,
  type RemediationLoopStepVM,
} from "@/lib/overlay-ui/reviewSecurityIssueUiAdapter";
import {
  OverlayUiBadge,
  OverlayUiEmptyHint,
  OverlayUiFindingList,
  OverlayUiKeyValueRow,
  OverlayUiRowCard,
  OverlayUiRowList,
  OverlayUiSection,
} from "./OverlayUiPrimitives";

export function OverlayRemediationLoopSection({
  overlay,
  defaultOpen,
}: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly defaultOpen?: boolean;
}) {
  const vm = buildRemediationLoopPlanVM(overlay?.remediationLoopPlan ?? null);
  return (
    <OverlayUiSection
      title="Remediation Loop Plan"
      description={vm.disclaimer}
      defaultOpen={defaultOpen}
    >
      {!vm.hasData ? (
        <OverlayUiEmptyHint
          message="이번 턴에 대해 기록된 조치 루프 step이 없습니다."
          secondary="조치 후보 issue가 정리되면 자동으로 검토 → 조치 → 재점검 단계가 표시됩니다."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Header vm={vm} />
          <OverlayUiFindingList findings={vm.findings} ariaLabel="Remediation Loop 진단" />
          <OverlayUiRowList>
            {vm.steps.map((step) => (
              <StepRow key={`${step.order}:${step.type}`} step={step} />
            ))}
          </OverlayUiRowList>
        </div>
      )}
    </OverlayUiSection>
  );
}

function Header({ vm }: { readonly vm: RemediationLoopPlanVM }) {
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
      <OverlayUiKeyValueRow label="총 단계" value={vm.totalLabel} />
    </div>
  );
}

function StepRow({ step }: { readonly step: RemediationLoopStepVM }) {
  return (
    <OverlayUiRowCard layout={{ gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <OverlayUiBadge tone="neutral" title="단계 순서">
          {step.orderLabel}
        </OverlayUiBadge>
        <OverlayUiBadge tone={step.typeTone} title="단계 유형">
          {step.typeLabel}
        </OverlayUiBadge>
        <OverlayUiBadge tone="info" title="actor 역할">
          {step.actorRole}
        </OverlayUiBadge>
      </div>
      <div style={{ fontSize: 12, color: t.textPrimary, lineHeight: 1.5 }}>
        {step.description}
      </div>
    </OverlayUiRowCard>
  );
}
