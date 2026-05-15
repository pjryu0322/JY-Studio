"use client";

import type { OverlayRuntimeCriticalitySectionVM } from "@/lib/overlay-ui/overlayRuntimeCriticalityAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeCriticalitySection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeCriticalitySectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Planning Criticality (H15.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="Criticality score" value={vm.criticalityScoreLabel} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Critical nodes</div>
        {vm.criticalNodes.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.criticalNodes.map((n, i) => (
              <li key={`cn-${i}`}>{n}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Critical node 없음" />
        )}
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>High priority nodes</div>
        {vm.highPriorityNodes.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.highPriorityNodes.slice(0, 6).map((n, i) => (
              <li key={`hp-${i}`}>{n}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="High priority node 없음" />
        )}
        <OverlayUiKeyValueRow
          label="Priority propagation"
          value={vm.priorityPropagationPaths.slice(0, 3).join(" · ") || "—"}
        />
        <OverlayUiKeyValueRow
          label="Escalation flow"
          value={vm.escalationFlowPaths.slice(0, 2).join(" · ") || "—"}
        />
        <OverlayUiKeyValueRow
          label="Critical dependency chain"
          value={vm.criticalDependencyChains.slice(0, 2).join(" · ") || "—"}
        />
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime orchestration·enforcement·payload 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
