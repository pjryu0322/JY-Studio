"use client";

import type { OverlayRuntimeSemanticNarrativeSectionVM } from "@/lib/overlay-ui/overlayRuntimeSemanticNarrativeAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeSemanticNarrativeSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeSemanticNarrativeSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Semantic Narrative (H18.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="Top narrative" value={vm.topNarrativeKo} />
        <OverlayUiKeyValueRow label="Critical path" value={vm.criticalPathLabel} />
        <OverlayUiKeyValueRow label="Warning collapse" value={vm.warningCollapseLabel} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Causal narratives</div>
        {vm.narrativeRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.narrativeRows.map((row) => (
              <li key={row.text}>
                <span style={{ fontWeight: 700 }}>[{row.severityLabel}]</span> {row.text}
              </li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Narrative 없음" />
        )}
        {vm.showDetailSections ? (
          <details style={{ fontSize: 11, color: t.textMuted }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Root-cause groups</summary>
            {vm.rootCauseRows.length > 0 ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.45 }}>
                {vm.rootCauseRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Root-cause group 없음" />
            )}
          </details>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime orchestration·enforcement·payload 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
