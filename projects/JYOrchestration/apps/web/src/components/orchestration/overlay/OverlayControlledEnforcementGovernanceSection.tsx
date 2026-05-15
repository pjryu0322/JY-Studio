"use client";

import type { OverlayControlledEnforcementGovernanceSectionVM } from "@/lib/overlay-ui/overlayControlledEnforcementGovernanceAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayControlledEnforcementGovernanceSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayControlledEnforcementGovernanceSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="통제 Enforcement Governance (H11.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="Governance 준비" value={vm.governanceReadinessLabel} />
        <OverlayUiKeyValueRow label="Governance 모드" value={vm.governanceModeLabel} />
        <OverlayUiKeyValueRow label="Governance 리스크" value={vm.governanceRiskLevelLabel} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>허용 가능 후보</div>
        {vm.eligibleCandidates.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: t.textSecondary, lineHeight: 1.45 }}>
            {vm.eligibleCandidates.map((c, i) => (
              <li key={`el-${i}`}>{c}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="허용 가능 후보 없음" />
        )}
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>차단된 후보</div>
        {vm.blockedCandidates.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: t.textSecondary, lineHeight: 1.45 }}>
            {vm.blockedCandidates.map((c, i) => (
              <li key={`bl-${i}`}>{c}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="차단 코드 없음" />
        )}
        <OverlayUiKeyValueRow label="필수 Governance 조건" value={vm.requiredGovernanceConditions.join(" · ") || "—"} />
        <OverlayUiKeyValueRow label="필수 Rollback 조건" value={vm.requiredRollbackConditions.join(" · ") || "—"} />
        <OverlayUiKeyValueRow label="필수 Auditability 조건" value={vm.requiredAuditabilityConditions.join(" · ") || "—"} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Dependency planning</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
          {vm.dependencyRows.map((r, i) => (
            <li key={`dep-${i}`}>
              <span style={{ fontWeight: 700 }}>{r.title}</span> (승인: {r.approvalLabel}, 롤백: {r.rollbackLabel}) — {r.note}
            </li>
          ))}
        </ul>
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Governance 위험 요인</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
          {vm.governanceRiskFactors.map((n, i) => (
            <li key={`grf-${i}`}>{n}</li>
          ))}
        </ul>
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          실제 enable·enforcement·승인·rollback 실행은 제공하지 않습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
