"use client";

import type { OverlayRuntimeReasoningSectionVM } from "@/lib/overlay-ui/overlayRuntimeReasoningAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeReasoningSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeReasoningSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Planning Reasoning (H16.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Unified chain (stable order)</div>
        {vm.stableOrderingRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.stableOrderingRows.slice(0, 6).map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Stable ordering 없음" />
        )}
        <OverlayUiKeyValueRow
          label="Propagation reasoning"
          value={vm.propagationReasoningRows.slice(0, 3).join(" · ") || "—"}
        />
        <OverlayUiKeyValueRow
          label="Dependency reasoning"
          value={vm.dependencyReasoningRows.slice(0, 3).join(" · ") || "—"}
        />
        <OverlayUiKeyValueRow
          label="Critical transitions"
          value={vm.criticalTransitionRows.slice(0, 2).join(" · ") || "—"}
        />
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>{vm.redundancyNote}</div>
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime orchestration·enforcement·payload 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
