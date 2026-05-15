"use client";

import type { OverlayOperatorRuntimeSummaryVM } from "@/lib/overlay-ui/overlayOperatorRuntimeSummaryAdapter";
import { OverlayUiSection, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";

const H85_DISCLAIMER =
  "운영 관측용 요약입니다. 실제 실행 허가·차단·이슈 처리 상태를 대신하지 않습니다.";

export function OverlayOperatorRuntimeSummary({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayOperatorRuntimeSummaryVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection title="운영 런타임 요약 (H8.5)" description={H85_DISCLAIMER} defaultOpen={defaultOpen}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <OverlayUiKeyValueRow label="Maturity 종합" value={vm.maturityOverallLabel} />
        <OverlayUiKeyValueRow label="Release gate" value={vm.releaseGateLabel} />
        <OverlayUiKeyValueRow label="경고(헤더 집계)" value={vm.warningCountLabel} />
        <OverlayUiKeyValueRow label="Execution safety" value={vm.executionSafetyStatusLabel} />
        <OverlayUiKeyValueRow label="Review / Security" value={vm.reviewSecurityLabel} />
        <OverlayUiKeyValueRow label="Explainability" value={vm.explainabilitySurfaceLabel} />
      </div>
    </OverlayUiSection>
  );
}
