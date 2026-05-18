"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { OverlayUiPruningSectionVM } from "@/lib/overlay-ui/overlayUiAdapter";
import { formatKoreanInt } from "@/lib/overlay-ui/overlayUiFormat";
import {
  OverlayUiEmptyHint,
  OverlayUiRowCard,
  OverlayUiRowList,
  OverlayUiSection,
  OverlayUiSourceText,
} from "./OverlayUiPrimitives";

const SECTION_DESCRIPTION =
  "중요도가 낮아 줄일 수 있는 후보입니다. 실제 제거는 수행되지 않습니다.";

export function OverlayPruningSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayUiPruningSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection title="축소 후보" description={SECTION_DESCRIPTION} defaultOpen={defaultOpen}>
      {!vm.hasData ? (
        <OverlayUiEmptyHint message={vm.description} />
      ) : (
        <OverlayUiRowList>
          {vm.rows.map((row, i) => (
            <OverlayUiRowCard
              key={`pr-${i}`}
              layout={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}
            >
              <OverlayUiSourceText
                source={row.source}
                maxWidth="min(60%, 240px)"
                style={{ color: t.textPrimary, fontWeight: 700, flex: "0 1 auto" }}
              />
              <span style={{ color: t.textMuted, fontSize: 11 }}>{row.reason}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: t.textMuted }}>
                절감 가능 ~{formatKoreanInt(row.estimatedReduction)}
              </span>
            </OverlayUiRowCard>
          ))}
        </OverlayUiRowList>
      )}
    </OverlayUiSection>
  );
}
