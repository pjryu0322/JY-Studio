"use client";

import type { OverlayRuntimeAdapterSandboxSectionVM } from "@/lib/overlay-ui/overlayRuntimeAdapterSandboxAdapter";
import {
  RUNTIME_ADAPTER_SANDBOX_EMPTY_HINT_KO,
  RUNTIME_ADAPTER_SANDBOX_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeAdapterSandbox/runtimeAdapterSandboxLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeAdapterSandboxSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeAdapterSandboxSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Adapter Sandbox (H26)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Sandbox readiness" value={vm.sandboxReadinessKo} />
        <OverlayUiKeyValueRow label="Sandbox mode" value={vm.sandboxModeKo} />
        {vm.topSandboxBlocker ? (
          <OverlayUiKeyValueRow label="Top sandbox blocker" value={vm.topSandboxBlocker} />
        ) : null}
        {!vm.topSandboxBlocker && vm.topForbiddenSandboxOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden operation" value={vm.topForbiddenSandboxOperation} />
        ) : null}
        {vm.showDetailSections ? (
          <>
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
              <OverlayUiEmptyHint message={RUNTIME_ADAPTER_SANDBOX_EMPTY_HINT_KO.inputEnvelope} />
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
              <OverlayUiEmptyHint message={RUNTIME_ADAPTER_SANDBOX_EMPTY_HINT_KO.outputEnvelope} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Forbidden sandbox operations</div>
            {vm.forbiddenSandboxOperationRows.length > 0 ? (
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
                {vm.forbiddenSandboxOperationRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_ADAPTER_SANDBOX_EMPTY_HINT_KO.forbiddenOperation} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Sandbox result metadata</div>
            {vm.sandboxResultRows.length > 0 ? (
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
                {vm.sandboxResultRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_ADAPTER_SANDBOX_EMPTY_HINT_KO.sandboxResult} />
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
              <OverlayUiEmptyHint message={RUNTIME_ADAPTER_SANDBOX_EMPTY_HINT_KO.recommendation} />
            )}
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>{RUNTIME_ADAPTER_SANDBOX_OVERLAY_FOOTER_KO}</div>
      </div>
    </OverlayUiSection>
  );
}
