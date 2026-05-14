"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { OverlayUiWarningRow, OverlayUiWarningSectionVM } from "@/lib/overlay-ui/overlayUiAdapter";
import { OVERLAY_UI_WARNING_DISCLAIMER } from "@/lib/overlay-ui/overlayUiDescription";
import {
  OverlayUiBadge,
  OverlayUiEmptyHint,
  OverlayUiRowCard,
  OverlayUiRowList,
  OverlayUiSection,
} from "./OverlayUiPrimitives";

function WarningRow({ row }: { readonly row: OverlayUiWarningRow }) {
  return (
    <OverlayUiRowCard>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <OverlayUiBadge tone={row.severityTone}>{row.severityLabel}</OverlayUiBadge>
        <code style={{ fontSize: 11, color: t.textMuted, wordBreak: "break-all" }}>{row.code}</code>
      </div>
      <div style={{ lineHeight: 1.5 }}>{row.message}</div>
    </OverlayUiRowCard>
  );
}

function WarningGroup({
  title,
  rows,
  keyPrefix,
}: {
  readonly title: string;
  readonly rows: readonly OverlayUiWarningRow[];
  readonly keyPrefix: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginBottom: 4 }}>{title}</div>
      {rows.length ? (
        <OverlayUiRowList>
          {rows.map((row, i) => (
            <WarningRow key={`${keyPrefix}-${i}`} row={row} />
          ))}
        </OverlayUiRowList>
      ) : null}
    </div>
  );
}

export function OverlayWarningSection({ vm }: { readonly vm: OverlayUiWarningSectionVM }) {
  return (
    <OverlayUiSection title="주의·정보" description={OVERLAY_UI_WARNING_DISCLAIMER}>
      {!vm.hasData ? (
        <OverlayUiEmptyHint message="현재 시점에 충돌·정책 정렬 경고가 감지되지 않았습니다." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <WarningGroup
            title={`충돌 가능성 — ${vm.conflictDescription}`}
            rows={vm.conflictRows}
            keyPrefix="cf"
          />
          <WarningGroup
            title={`정책 정렬 — ${vm.driftDescription}`}
            rows={vm.driftRows}
            keyPrefix="dr"
          />
        </div>
      )}
    </OverlayUiSection>
  );
}
