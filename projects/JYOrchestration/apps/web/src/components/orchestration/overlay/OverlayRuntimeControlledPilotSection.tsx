"use client";

import type { OverlayRuntimeControlledPilotSectionVM } from "@/lib/overlay-ui/overlayRuntimeControlledPilotAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeControlledPilotSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeControlledPilotSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Controlled Orchestration Runtime Pilot (H24)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Pilot readiness" value={vm.pilotReadinessKo} />
        <OverlayUiKeyValueRow label="Pilot scope" value={vm.pilotScopeKo} />
        <OverlayUiKeyValueRow label="Candidate flow" value={vm.candidateFlowKo} />
        {vm.topSafetyBlocker ? (
          <OverlayUiKeyValueRow label="Top safety blocker" value={vm.topSafetyBlocker} />
        ) : null}
        {vm.topAbortCondition ? (
          <OverlayUiKeyValueRow label="Top abort condition" value={vm.topAbortCondition} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Safety blockers (meta)</div>
            {vm.safetyBlockerRows.length > 0 ? (
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
                {vm.safetyBlockerRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Safety blocker 없음" />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Fallback requirements (meta)</div>
            {vm.fallbackRequirementRows.length > 0 ? (
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
                {vm.fallbackRequirementRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Fallback requirement 없음" />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Abort conditions (meta)</div>
            {vm.abortConditionRows.length > 0 ? (
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
                {vm.abortConditionRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Abort condition 없음" />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Forbidden pilot execution scopes</div>
            {vm.forbiddenScopeRows.length > 0 ? (
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
                {vm.forbiddenScopeRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="금지 스코프 없음" />
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
          actual runtime pilot·provider routing·queue control·rollback·prompt 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
