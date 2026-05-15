"use client";

import type { OverlayRuntimePrioritySectionVM } from "@/lib/overlay-ui/overlayRuntimePriorityAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimePrioritySection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimePrioritySectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Priority (H12.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="Planning priority" value={vm.overallPlanningPriorityLabel} />
        <OverlayUiKeyValueRow label="Escalation" value={vm.escalationLevelLabel} />
        <OverlayUiKeyValueRow label="운영자 attention" value={vm.operatorAttentionLabel} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Dependency ordering</div>
        {vm.dependencyRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.dependencyRows.map((r, i) => (
              <li key={`dep-${i}`}>
                <span style={{ fontWeight: 700 }}>{r.title}</span> [{r.priorityLabel}/{r.status}] — {r.note}
              </li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="dependency 행 없음" />
        )}
        <OverlayUiKeyValueRow label="Critical dependency" value={vm.criticalDependencies.join(" · ") || "—"} />
        {vm.dependencyCycles.length > 0 ? (
          <OverlayUiKeyValueRow label="순환 신호" value={vm.dependencyCycles.join(" · ")} />
        ) : null}
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Bottleneck</div>
        {vm.bottleneckRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.bottleneckRows.map((r, i) => (
              <li key={`bn-${i}`}>
                <span style={{ fontWeight: 700 }}>{r.title}</span> ({r.priorityLabel}) — {r.note}
              </li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="병목 없음" />
        )}
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Escalation 사유</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
          {vm.escalationReasons.map((n, i) => (
            <li key={`er-${i}`}>{n}</li>
          ))}
        </ul>
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime orchestration·provider routing·retrieval orchestration은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
