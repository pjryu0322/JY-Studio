"use client";

import type { OverlayRuntimeTraceabilitySectionVM } from "@/lib/overlay-ui/overlayRuntimeTraceabilityAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeTraceabilitySection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeTraceabilitySectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Planning Traceability (H16)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Reasoning steps</div>
        {vm.reasoningStepRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.reasoningStepRows.slice(0, 6).map((s) => (
              <li key={s.id}>
                {s.label} — {s.explanation}
              </li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Reasoning step 없음" />
        )}
        <OverlayUiKeyValueRow
          label="Dependency trace"
          value={vm.dependencyTracePaths.slice(0, 3).join(" · ") || "—"}
        />
        <OverlayUiKeyValueRow
          label="Priority trace"
          value={vm.priorityTracePaths.slice(0, 3).join(" · ") || "—"}
        />
        <OverlayUiKeyValueRow
          label="Critical transitions"
          value={vm.criticalTransitionChains.slice(0, 2).join(" · ") || "—"}
        />
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime orchestration·enforcement·payload 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
