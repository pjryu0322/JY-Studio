"use client";

import type { OverlayRuntimePilotSkeletonSectionVM } from "@/lib/overlay-ui/overlayRuntimePilotSkeletonAdapter";
import {
  RUNTIME_PILOT_SKELETON_EMPTY_HINT_KO,
  RUNTIME_PILOT_SKELETON_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimePilotSkeleton/runtimePilotSkeletonLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimePilotSkeletonSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimePilotSkeletonSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Pilot Skeleton (H28)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Pilot skeleton readiness" value={vm.skeletonReadinessKo} />
        <OverlayUiKeyValueRow label="Runner mode" value={vm.runnerModeKo} />
        {vm.topSkeletonBlocker ? (
          <OverlayUiKeyValueRow label="Top skeleton blocker" value={vm.topSkeletonBlocker} />
        ) : null}
        {!vm.topSkeletonBlocker && vm.topForbiddenRunnerOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden operation" value={vm.topForbiddenRunnerOperation} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayUiKeyValueRow label="Dry-run runner contract" value={vm.contractRunnerName} />
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Input envelope</div>
            {vm.inputEnvelopeSummaryRows.length > 0 ? (
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
                {vm.inputEnvelopeSummaryRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_PILOT_SKELETON_EMPTY_HINT_KO.inputEnvelope} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Output envelope</div>
            {vm.outputEnvelopeSummaryRows.length > 0 ? (
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
                {vm.outputEnvelopeSummaryRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_PILOT_SKELETON_EMPTY_HINT_KO.outputEnvelope} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Forbidden runner operations</div>
            {vm.forbiddenRunnerOperationRows.length > 0 ? (
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
                {vm.forbiddenRunnerOperationRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_PILOT_SKELETON_EMPTY_HINT_KO.forbiddenOperation} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Runner safety guard</div>
            {vm.safetyGuardRows.length > 0 ? (
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
                {vm.safetyGuardRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_PILOT_SKELETON_EMPTY_HINT_KO.safetyGuard} />
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
              <OverlayUiEmptyHint message={RUNTIME_PILOT_SKELETON_EMPTY_HINT_KO.recommendation} />
            )}
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>{RUNTIME_PILOT_SKELETON_OVERLAY_FOOTER_KO}</div>
      </div>
    </OverlayUiSection>
  );
}
