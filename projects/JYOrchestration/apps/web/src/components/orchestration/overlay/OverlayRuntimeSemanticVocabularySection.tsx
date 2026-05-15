"use client";

import type { OverlayRuntimeSemanticVocabularySectionVM } from "@/lib/overlay-ui/overlayRuntimeSemanticVocabularyAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeSemanticVocabularySection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeSemanticVocabularySectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Semantic Vocabulary (H19)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="Top priority" value={vm.topPriorityLabel} />
        <OverlayUiKeyValueRow label="Wording collapse" value={vm.collapsedDuplicateLabel} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Canonical labels</div>
        {vm.canonicalLabelRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.canonicalLabelRows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Canonical label 없음" />
        )}
        {vm.showDetailSections ? (
          <>
            <details style={{ fontSize: 11, color: t.textMuted }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>Priority vocabulary</summary>
              {vm.priorityRows.length > 0 ? (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.45 }}>
                  {vm.priorityRows.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ul>
              ) : (
                <OverlayUiEmptyHint message="Priority vocabulary 없음" />
              )}
            </details>
            <details style={{ fontSize: 11, color: t.textMuted }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>Root-cause normalized wording</summary>
              {vm.rootCauseNormalizedRows.length > 0 ? (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.45 }}>
                  {vm.rootCauseNormalizedRows.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ul>
              ) : (
                <OverlayUiEmptyHint message="Normalized root-cause 없음" />
              )}
            </details>
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime orchestration·enforcement·payload 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
