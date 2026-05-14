"use client";

/**
 * Harness Phase H3 — **Overlay Knowledge Activation Section**.
 *
 * Prompt Timeline Overlay 탭에서 "이번 턴에 어떤 지식팩이 왜 활성화 후보가 되었는지"를 표시한다.
 *
 * **read-only / planning metadata display.** 실제 검색·주입이 아님을 상단에 명시한다.
 */

import { uiTokens as t } from "@/components/ui/tokens";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildKnowledgeActivationPlanVM } from "@/lib/overlay-ui/knowledgeActivationUiAdapter";
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

export function OverlayKnowledgeActivationSection({
  overlay,
  defaultOpen,
}: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly defaultOpen?: boolean;
}) {
  const vm = buildKnowledgeActivationPlanVM(overlay?.knowledgeActivationPlan ?? null);
  return (
    <OverlayUiSection
      title="Knowledge Activation Plan"
      description={vm.disclaimer}
      defaultOpen={defaultOpen}
    >
      {!vm.hasData ? (
        <OverlayUiEmptyHint
          message="이번 턴에 활성화 후보로 추천된 지식팩이 기록되지 않았습니다."
          secondary="역할/단계/작업 유형이 정해지면 자동으로 후보가 보강됩니다."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <PlanHeader vm={vm} />
          <OverlayUiFindingList
            findings={vm.findings}
            ariaLabel="Knowledge Activation 진단"
          />
          <OverlayUiRowList>
            {vm.items.map((item) => (
              <OverlayUiRowCard key={item.knowledgePackId} layout={{ gap: 4 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ color: t.textPrimary }}>
                    <OverlayUiSourceText source={item.knowledgePackId} />
                  </strong>
                  <OverlayUiBadge tone={item.priorityTone} title="활성화 우선순위">
                    {item.priorityLabel}
                  </OverlayUiBadge>
                  <OverlayUiBadge tone={item.reasonTypeTone} title="활성화 사유 분류">
                    {item.reasonTypeLabel}
                  </OverlayUiBadge>
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
                  {item.reasonLabel}
                </div>
                {item.contextHint ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: t.textMuted,
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <span>{item.contextHint}</span>
                  </div>
                ) : null}
              </OverlayUiRowCard>
            ))}
          </OverlayUiRowList>
        </div>
      )}
    </OverlayUiSection>
  );
}

function PlanHeader({
  vm,
}: {
  readonly vm: ReturnType<typeof buildKnowledgeActivationPlanVM>;
}) {
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
        label="역할 / 단계 / 작업 유형"
        value={`${vm.roleLabel.replace(/^역할:\s*/, "")} · ${vm.stageLabel.replace(/^단계:\s*/, "")} · ${vm.taskTypeLabel.replace(/^작업 유형:\s*/, "")}`}
      />
      <OverlayUiKeyValueRow
        label="후보 / 우선순위"
        value={`${vm.totalLabel} · ${vm.requiredLabel} · ${vm.recommendedLabel} · ${vm.optionalLabel}`}
      />
      <OverlayUiKeyValueRow label="사유 분포" value={vm.reasonBreakdownText} />
    </div>
  );
}
