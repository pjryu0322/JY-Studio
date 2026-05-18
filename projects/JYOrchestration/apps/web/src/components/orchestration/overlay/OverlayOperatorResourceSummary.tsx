"use client";

import type { OverlayOperatorResourceSummaryVM } from "@/lib/overlay-ui/overlayOperatorResourceSummaryAdapter";
import { OverlayUiSection, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";

const H95_DISCLAIMER =
  "자원·과밀·노이즈는 휴리스틱 요약입니다. 실제 할당·차단·토큰 강제를 대신하지 않습니다.";

export function OverlayOperatorResourceSummary({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayOperatorResourceSummaryVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection title="운영 자원·과밀 (H9.5)" description={H95_DISCLAIMER} defaultOpen={defaultOpen}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <OverlayUiKeyValueRow label="압력 심각도" value={vm.pressureSeverityLabel} />
        <OverlayUiKeyValueRow label="복합 점수" value={vm.compositeScoreLabel} />
        <OverlayUiKeyValueRow label="Overlay 과밀 위험" value={vm.overloadRiskLabel} />
        <OverlayUiKeyValueRow label="Explainability 노이즈(추정)" value={vm.explainabilityNoiseLabel} />
        <OverlayUiKeyValueRow label="경고 집중도" value={vm.warningConcentrationLabel} />
        <OverlayUiKeyValueRow label="메모리 압력" value={vm.memoryPressureLabel} />
        <OverlayUiKeyValueRow label="리뷰/보안 압력" value={vm.reviewPressureLabel} />
        <OverlayUiKeyValueRow label="완화 힌트(예)" value={vm.mitigationHintSample || "—"} />
      </div>
    </OverlayUiSection>
  );
}
