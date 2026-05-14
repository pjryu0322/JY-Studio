"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { OverlayUiWarningRow, OverlayUiWarningSectionVM } from "@/lib/overlay-ui/overlayUiAdapter";
import { OVERLAY_UI_WARNING_DISCLAIMER } from "@/lib/overlay-ui/overlayUiDescription";
import { OverlayUiBadge, OverlayUiEmptyHint, OverlayUiSection } from "./OverlayUiPrimitives";

function WarningRow({ row }: { readonly row: OverlayUiWarningRow }) {
  return (
    <li
      style={{
        fontSize: 12,
        color: t.textSecondary,
        padding: "6px 10px",
        background: "#fff",
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <OverlayUiBadge tone={row.severityTone}>{row.severityLabel}</OverlayUiBadge>
        <code style={{ fontSize: 11, color: t.textMuted, wordBreak: "break-all" }}>{row.code}</code>
      </div>
      <div style={{ lineHeight: 1.5 }}>{row.message}</div>
    </li>
  );
}

export function OverlayWarningSection({ vm }: { readonly vm: OverlayUiWarningSectionVM }) {
  return (
    <OverlayUiSection title="주의·정보" description={OVERLAY_UI_WARNING_DISCLAIMER}>
      {!vm.hasData ? (
        <OverlayUiEmptyHint message="현재 시점에 충돌·정책 정렬 경고가 감지되지 않았습니다." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginBottom: 4 }}>
              충돌 가능성 — {vm.conflictDescription}
            </div>
            {vm.conflictRows.length ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {vm.conflictRows.map((row, i) => (
                  <WarningRow key={`cf-${i}`} row={row} />
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginBottom: 4 }}>
              정책 정렬 — {vm.driftDescription}
            </div>
            {vm.driftRows.length ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {vm.driftRows.map((row, i) => (
                  <WarningRow key={`dr-${i}`} row={row} />
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )}
    </OverlayUiSection>
  );
}
