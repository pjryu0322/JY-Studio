"use client";

import type { OverlayResourceOrchestrationSectionVM } from "@/lib/overlay-ui/overlayResourceOrchestrationAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiBadge, OverlayUiEmptyHint, OverlayUiKeyValueRow, OverlayUiSection } from "./OverlayUiPrimitives";

export function OverlayResourceOrchestrationSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayResourceOrchestrationSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection title="자원 오케스트레이션 (H9)" description={vm.sectionDisclaimer} defaultOpen={defaultOpen}>
      {!vm.hasData ? (
        <OverlayUiEmptyHint message="이 시점에 자원·예산 신호가 거의 없습니다. Overlay 메타가 쌓이면 계획 힌트가 표시됩니다." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <OverlayUiKeyValueRow label="역할(계획)" value={vm.roleDisplay ?? "역할 미지정"} />
          <OverlayUiKeyValueRow label="프로바이더·실행 형태" value={vm.providerPlanLabel} />
          <OverlayUiKeyValueRow label="검색·컨텍스트 태도(계획)" value={vm.retrievalStanceLabel} />
          <OverlayUiKeyValueRow label="메모리 태도(계획)" value={vm.memoryStanceLabel} />
          <OverlayUiKeyValueRow label="지식 태도(계획)" value={vm.knowledgeStanceLabel} />
          <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>{vm.concurrencyHint}</div>
          <OverlayUiKeyValueRow
            label="자원 압력(휴리스틱)"
            value={`점수 ${vm.pressureScore} · ${vm.pressureLevelLabel}`}
            badge={<OverlayUiBadge tone={vm.pressureTone}>{vm.pressureLevelLabel}</OverlayUiBadge>}
          />
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.pressureFactors.map((f, i) => (
              <li key={`pf-${i}`}>{f}</li>
            ))}
          </ul>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: t.textPrimary,
              borderTop: `1px solid ${t.border}`,
              paddingTop: 8,
            }}
          >
            Context budget 권장(읽기 전용)
          </div>
          <OverlayUiKeyValueRow label="현재(기록)" value={vm.currentBudgetPolicyLabel} />
          <OverlayUiKeyValueRow label="권장 힌트" value={vm.recommendedBudgetPolicyLabel} />
          <OverlayUiKeyValueRow
            label="정렬"
            value={vm.budgetPolicyAligned ? "현재 정책과 권장이 일치" : "현재 정책과 권장이 다름(자동 변경 없음)"}
          />
          <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>{vm.budgetRecommendationRationale}</div>
        </div>
      )}
    </OverlayUiSection>
  );
}
