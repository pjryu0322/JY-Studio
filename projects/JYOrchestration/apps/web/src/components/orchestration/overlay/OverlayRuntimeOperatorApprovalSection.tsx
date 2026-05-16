"use client";

import type { OverlayRuntimeOperatorApprovalSectionVM } from "@/lib/overlay-ui/overlayRuntimeOperatorApprovalAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeOperatorApprovalSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeOperatorApprovalSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Operator Approval & Rollback Readiness (H23.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Approval readiness" value={vm.approvalReadinessKo} />
        <OverlayUiKeyValueRow label="Rollback readiness" value={vm.rollbackReadinessKo} />
        <OverlayUiKeyValueRow label="Audit readiness" value={vm.auditReadinessKo} />
        <OverlayUiKeyValueRow label="Pilot preconditions" value={vm.pilotPreconditionReadinessKo} />
        {vm.topApprovalBlocker ? (
          <OverlayUiKeyValueRow label="Top approval blocker" value={vm.topApprovalBlocker} />
        ) : null}
        {vm.topRollbackBlocker ? (
          <OverlayUiKeyValueRow label="Top rollback blocker" value={vm.topRollbackBlocker} />
        ) : null}
        {vm.topAuditFinding ? <OverlayUiKeyValueRow label="Top audit finding" value={vm.topAuditFinding} /> : null}
        {vm.topPilotNote ? <OverlayUiKeyValueRow label="Pilot note" value={vm.topPilotNote} /> : null}
        {vm.showDetailSections ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Required review items (meta)</div>
            {vm.requiredReviewRows.length > 0 ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 11,
                  color: t.textMuted,
                  lineHeight: 1.45,
                  overflowWrap: "anywhere" as const,
                }}
              >
                {vm.requiredReviewRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="필수 검토 메타 없음" />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Rollback prerequisites (meta)</div>
            {vm.rollbackPrerequisiteRows.length > 0 ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 11,
                  color: t.textMuted,
                  lineHeight: 1.45,
                  overflowWrap: "anywhere" as const,
                }}
              >
                {vm.rollbackPrerequisiteRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Rollback prerequisite 없음" />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Rollback audit trail hints</div>
            {vm.rollbackAuditHintRows.length > 0 ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 11,
                  color: t.textMuted,
                  lineHeight: 1.45,
                  overflowWrap: "anywhere" as const,
                }}
              >
                {vm.rollbackAuditHintRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="감사 trail 힌트 없음" />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Recommendations</div>
            {vm.recommendationRows.length > 0 ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 11,
                  color: t.textMuted,
                  lineHeight: 1.45,
                  overflowWrap: "anywhere" as const,
                }}
              >
                {vm.recommendationRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Recommendation 없음" />
            )}
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual approval·rollback·runtime pilot 실행·routing·provider switching은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
