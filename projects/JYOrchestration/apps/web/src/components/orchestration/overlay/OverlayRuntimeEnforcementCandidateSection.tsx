"use client";

import type { OverlayRuntimeEnforcementCandidateSectionVM } from "@/lib/overlay-ui/overlayRuntimeEnforcementCandidateAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeEnforcementCandidateSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeEnforcementCandidateSectionVM;
  readonly defaultOpen?: boolean;
}) {
  const hasBlocked = vm.blockedCapabilities.length > 0;
  const hasCandidates = vm.candidateCapabilities.length > 0;

  return (
    <OverlayUiSection
      title="런타임 Enforcement 후보 (H11)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="후보 모드" value={vm.candidateReadinessLabel} />
        <OverlayUiKeyValueRow label="후보 적격" value={vm.candidateEligibleLabel} />
        <OverlayUiKeyValueRow label="후보 리스크(메타)" value={vm.riskLevelLabel} />
        <OverlayUiKeyValueRow label="Enforcement 위험 요약" value={vm.enforcementRiskLevelLabel} />
        <OverlayUiKeyValueRow label="Governance 의존" value={vm.governanceDependencyLabel} />
        <OverlayUiKeyValueRow label="Rollback 의존" value={vm.rollbackDependencyLabel} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>차단된 capability</div>
        {hasBlocked ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: t.textSecondary, lineHeight: 1.45 }}>
            {vm.blockedCapabilities.map((c, i) => (
              <li key={`b-${i}`}>{c}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="차단 코드 없음" />
        )}
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>후보 capability</div>
        {hasCandidates ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: t.textSecondary, lineHeight: 1.45 }}>
            {vm.candidateCapabilities.map((c, i) => (
              <li key={`c-${i}`}>{c}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="표시할 후보 capability 없음" />
        )}
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Capability planning</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
          {vm.capabilityRows.map((r, i) => (
            <li key={`cap-${i}`}>
              <span style={{ fontWeight: 700 }}>{r.title}</span> ({r.statusLabel}) — {r.note}
            </li>
          ))}
        </ul>
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>위험 요인</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
          {vm.riskFactorNotes.map((n, i) => (
            <li key={`rf-${i}`}>{n}</li>
          ))}
        </ul>
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          실제 enable·routing·게이팅·rollback 실행은 제공하지 않습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
