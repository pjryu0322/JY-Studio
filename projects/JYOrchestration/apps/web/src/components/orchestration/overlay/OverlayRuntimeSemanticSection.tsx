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
      title="Planning Semantic (H17–H17.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="압축 품질" value={vm.qualityLabel} />
        <OverlayUiKeyValueRow label="Compression" value={vm.compressionRatioLabel} />
        <OverlayUiKeyValueRow label="숨김 trace" value={vm.hiddenTraceCountLabel} />
        <OverlayUiKeyValueRow label="중요 신호 숨김" value={vm.hiddenCriticalCountLabel} />
        <OverlayUiKeyValueRow label="중요 신호 유지" value={vm.preservedCriticalCountLabel} />
        <OverlayUiKeyValueRow label="Group balance" value={vm.groupBalanceLabel} />
        {vm.showOverCompressionWarning ? (
          <div style={{ fontSize: 10, color: "#b45309", lineHeight: 1.4 }}>
            과압축 경고: mobile-safe를 위해 trace가 많이 생략되었을 수 있습니다.
          </div>
        ) : null}
        {vm.showDetailSections ? (
          <>
            <details style={{ fontSize: 11, color: t.textMuted }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>Hidden trace audit</summary>
              {vm.hiddenAuditSummaryRows.length > 0 ? (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.45 }}>
                  {vm.hiddenAuditSummaryRows.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ul>
              ) : (
                <OverlayUiEmptyHint message="숨김 audit 없음" />
              )}
            </details>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Group balance</div>
            {vm.groupBalanceRows.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
                {vm.groupBalanceRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : null}
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
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime orchestration·enforcement·payload 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
