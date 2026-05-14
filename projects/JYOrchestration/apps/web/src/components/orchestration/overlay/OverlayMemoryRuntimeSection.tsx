"use client";

/**
 * Harness Phase H4 Preparation — **Overlay Memory Runtime Section**.
 *
 * Prompt Timeline Overlay 탭에서 "이번 턴에 AI가 참조 후보로 삼은 메모리 계획"을 표시한다.
 *
 * **read-only / planning metadata display.** 실제 long-term memory가 아님을 상단에 명시한다.
 */

import { uiTokens as t } from "@/components/ui/tokens";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildMemoryRuntimePlanVM } from "@/lib/overlay-ui/memoryRuntimeUiAdapter";
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

export function OverlayMemoryRuntimeSection({
  overlay,
  defaultOpen,
}: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly defaultOpen?: boolean;
}) {
  const vm = buildMemoryRuntimePlanVM(overlay?.memoryRuntimePlan ?? null);
  return (
    <OverlayUiSection
      title="Memory Runtime Plan"
      description={vm.disclaimer}
      defaultOpen={defaultOpen}
    >
      {!vm.hasData ? (
        <OverlayUiEmptyHint
          message="이번 턴에 참조 후보로 삼은 메모리가 기록되지 않았습니다."
          secondary="대화·문맥이 누적되면 자동으로 후보가 보강됩니다."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <PlanHeader vm={vm} />
          <OverlayUiFindingList findings={vm.findings} ariaLabel="Memory Runtime 진단" />
          <OverlayUiRowList>
            {vm.references.map((ref) => (
              <OverlayUiRowCard key={ref.memoryId} layout={{ gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <strong style={{ color: t.textPrimary }}>
                    <OverlayUiSourceText source={ref.memoryId} />
                  </strong>
                  <OverlayUiBadge tone={ref.scopeTone} title="메모리 스코프">
                    {ref.scopeLabel}
                  </OverlayUiBadge>
                  <OverlayUiBadge tone={ref.freshnessTone} title="freshness 평가">
                    {ref.freshnessLabel}
                  </OverlayUiBadge>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: t.textMuted }}>
                    {ref.estimatedImportanceLabel}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: t.textMuted,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {ref.summary}
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
                  <span>{ref.selectedReasonLabel}</span>
                  <span>{ref.selectedByLabel}</span>
                </div>
              </OverlayUiRowCard>
            ))}
          </OverlayUiRowList>
        </div>
      )}
    </OverlayUiSection>
  );
}

function PlanHeader({ vm }: { readonly vm: ReturnType<typeof buildMemoryRuntimePlanVM> }) {
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
      <OverlayUiKeyValueRow label="역할" value={vm.roleLabel.replace(/^역할:\s*/, "")} />
      <OverlayUiKeyValueRow
        label="후보 / freshness"
        value={`${vm.totalLabel} · ${vm.freshLabel} · ${vm.agingLabel} · ${vm.staleLabel}`}
      />
      <OverlayUiKeyValueRow label="스코프 분포" value={vm.scopeBreakdownText} />
    </div>
  );
}
