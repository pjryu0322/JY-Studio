"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { OverlayUiPruningSectionVM } from "@/lib/overlay-ui/overlayUiAdapter";
import { OverlayUiEmptyHint, OverlayUiSection } from "./OverlayUiPrimitives";

export function OverlayPruningSection({ vm }: { readonly vm: OverlayUiPruningSectionVM }) {
  return (
    <OverlayUiSection
      title="축소 후보"
      description="중요도가 낮아 줄일 수 있는 후보입니다. 실제 제거는 수행되지 않습니다."
    >
      {!vm.hasData ? (
        <OverlayUiEmptyHint message={vm.description} />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {vm.rows.map((row, i) => (
            <li
              key={`pr-${i}`}
              style={{
                fontSize: 12,
                color: t.textSecondary,
                padding: "6px 10px",
                background: "#fff",
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <strong style={{ color: t.textPrimary, wordBreak: "break-all" }}>{row.source}</strong>
              <span style={{ color: t.textMuted, fontSize: 11 }}>{row.reason}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: t.textMuted }}>
                절감 가능 ~{row.estimatedReduction.toLocaleString("ko-KR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </OverlayUiSection>
  );
}
