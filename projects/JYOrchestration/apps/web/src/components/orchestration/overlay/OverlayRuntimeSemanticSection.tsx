"use client";

import type { OverlayRuntimeSemanticSectionVM } from "@/lib/overlay-ui/overlayRuntimeSemanticAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeSemanticSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeSemanticSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Planning Semantic (H17)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="Compression" value={vm.compressionRatioLabel} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Semantic groups</div>
        {vm.semanticGroupRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.semanticGroupRows.slice(0, 4).map((g) => (
              <li key={g.label}>
                {g.label}: {g.items.slice(0, 2).join(" · ") || "—"}
              </li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Semantic group 없음" />
        )}
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Compressed trace</div>
        {vm.compressedTraceRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>
            {vm.compressedTraceRows.slice(0, 5).map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Compressed trace 없음" />
        )}
        <OverlayUiKeyValueRow
          label="Stable ordering"
          value={vm.stabilizedOrderingRows.slice(0, 4).join(" → ") || "—"}
        />
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>{vm.redundancyNote}</div>
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime orchestration·enforcement·payload 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
