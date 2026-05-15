"use client";

import type { OverlayRuntimeGovernanceSectionVM } from "@/lib/overlay-ui/overlayRuntimeGovernanceAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeGovernanceSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeGovernanceSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="런타임 거버넌스 준비 (H10.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="승인·위임 준비" value={vm.approvalReadinessLabel} />
        <OverlayUiKeyValueRow label="롤백 준비(계획)" value={vm.rollbackReadinessLabel} />
        <OverlayUiKeyValueRow label="운영자 검토" value={vm.operatorReviewReadinessLabel} />
        <OverlayUiKeyValueRow label="거버넌스 리스크" value={vm.governanceRiskLabel} />
        <OverlayUiKeyValueRow label="감사 가능성(계획)" value={vm.auditabilityLevelLabel} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>거버넌스 차단 요인</div>
        {vm.governanceBlockers.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: t.textSecondary, lineHeight: 1.45 }}>
            {vm.governanceBlockers.map((b, i) => (
              <li key={`gb-${i}`}>{b}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="차단 요인 없음" />
        )}
        <OverlayUiKeyValueRow label="롤백 안전(휴리스틱)" value={vm.rollbackSafetyRiskLabel} />
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
          {vm.rollbackSafetyFactors.map((f, i) => (
            <li key={`rb-${i}`}>{f}</li>
          ))}
        </ul>
        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>{vm.auditabilityDisclaimer}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted }}>감사 추적 후보(저장 없음)</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
          {vm.auditabilityRows.map((r, i) => (
            <li key={`au-${i}`}>
              <span style={{ fontWeight: 600 }}>{r.title}</span> — {r.note}
            </li>
          ))}
        </ul>
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          승인 버튼·실제 rollback·감사 로그 저장은 제공하지 않습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
