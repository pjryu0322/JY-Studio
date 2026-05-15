"use client";

import type { OverlayRuntimeDependencyGraphSectionVM } from "@/lib/overlay-ui/overlayRuntimeDependencyAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeDependencyGraphSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeDependencyGraphSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Planning Dependency (H15)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="Conflict ???" value={vm.conflictSeverityLabel} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Nodes</div>
        {vm.nodeRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.nodeRows.map((n) => (
              <li key={n.id}>
                {n.label} ? {n.statusLabel}
              </li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Node ??" />
        )}
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Edges</div>
        {vm.edgeRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.edgeRows.slice(0, 6).map((e, i) => (
              <li key={`e-${i}`}>{e}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Edge ??" />
        )}
        <OverlayUiKeyValueRow label="Critical dependency" value={vm.criticalDependencies.join(" ? ") || "?"} />
        <OverlayUiKeyValueRow label="Dependency chain" value={vm.dependencyChains.join(" ? ") || "?"} />
        <OverlayUiKeyValueRow
          label="Drift propagation"
          value={vm.driftPropagationPaths.slice(0, 2).join(" ? ") || "?"}
        />
        <OverlayUiKeyValueRow
          label="Stale propagation"
          value={vm.stalePropagationPaths.slice(0, 2).join(" ? ") || "?"}
        />
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime orchestration?enforcement?payload ??? ????.
        </div>
      </div>
    </OverlayUiSection>
  );
}
