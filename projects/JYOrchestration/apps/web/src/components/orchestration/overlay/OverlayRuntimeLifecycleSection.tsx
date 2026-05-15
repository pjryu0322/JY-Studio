"use client";

import type { OverlayRuntimeLifecycleSectionVM } from "@/lib/overlay-ui/overlayRuntimeLifecycleAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeLifecycleSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeLifecycleSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Lifecycle (H13.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="Freshness" value={vm.freshnessLabel} />
        <OverlayUiKeyValueRow label="Lifecycle state" value={vm.lifecycleStateLabel} />
        <OverlayUiKeyValueRow label="Drift 심각도" value={vm.driftSeverityLabel} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Drift 영역</div>
        {vm.driftAreas.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.driftAreas.map((a, i) => (
              <li key={`da-${i}`}>{a}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Drift 영역 없음" />
        )}
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>무효화 후보</div>
        {vm.invalidationCandidates.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.invalidationCandidates.map((c, i) => (
              <li key={`ic-${i}`}>{c}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="무효화 후보 없음" />
        )}
        <OverlayUiKeyValueRow label="Stale dependency" value={vm.staleDependencies.join(" · ") || "—"} />
        <OverlayUiKeyValueRow label="Stale planning area" value={vm.stalePlanningAreas.join(" · ") || "—"} />
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime orchestration·enforcement·payload 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
