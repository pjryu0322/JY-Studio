"use client";

import type { OverlayUiBudgetSectionVM } from "@/lib/overlay-ui/overlayUiAdapter";
import { OVERLAY_UI_BUDGET_DISCLAIMER } from "@/lib/overlay-ui/overlayUiDescription";
import { formatKoreanInt } from "@/lib/overlay-ui/overlayUiFormat";
import { OverlayUiBadge, OverlayUiEmptyHint, OverlayUiKeyValueRow, OverlayUiSection } from "./OverlayUiPrimitives";

export function OverlayBudgetSection({ vm }: { readonly vm: OverlayUiBudgetSectionVM }) {
  return (
    <OverlayUiSection title="토큰 예산" description={OVERLAY_UI_BUDGET_DISCLAIMER}>
      {!vm.hasData ? (
        <OverlayUiEmptyHint message="이 시점에 토큰 예산 정보가 기록되지 않았습니다." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <OverlayUiKeyValueRow label="예산 정책" value={vm.budgetPolicyLabel} />
          <OverlayUiKeyValueRow
            label="과부하 위험"
            value={vm.overflowRiskDescription}
            badge={<OverlayUiBadge tone={vm.overflowRiskTone}>{vm.overflowRiskLabel}</OverlayUiBadge>}
          />
          <OverlayUiKeyValueRow label="추정 입력 토큰" value={formatKoreanInt(vm.estimatedInputTokens)} />
          <OverlayUiKeyValueRow label="추정 출력 토큰" value={formatKoreanInt(vm.estimatedOutputTokens)} />
        </div>
      )}
    </OverlayUiSection>
  );
}
