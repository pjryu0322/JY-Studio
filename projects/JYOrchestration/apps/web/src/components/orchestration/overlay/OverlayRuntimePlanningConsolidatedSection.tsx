"use client";

import type { OverlayRuntimePlanningConsolidatedSectionVM } from "@/lib/overlay-ui/overlayRuntimePlanningConsolidatedAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimePlanningConsolidatedSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimePlanningConsolidatedSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Planning (H14.5 unified)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="Stability" value={`${vm.stabilityHeadline} — ${vm.stabilityDetail}`} />
        <OverlayUiKeyValueRow label="Priority" value={`${vm.priorityHeadline} — ${vm.priorityDetail}`} />
        <OverlayUiKeyValueRow label="Lifecycle" value={`${vm.lifecycleHeadline} — ${vm.lifecycleDetail}`} />
        <OverlayUiKeyValueRow label="Coherence" value={`${vm.coherenceHeadline} — ${vm.coherenceDetail}`} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Critical issues</div>
        {vm.criticalIssues.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.criticalIssues.map((issue, i) => (
              <li key={`ci-${i}`}>{issue}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Critical issue 없음" />
        )}
      </div>
    </OverlayUiSection>
  );
}
