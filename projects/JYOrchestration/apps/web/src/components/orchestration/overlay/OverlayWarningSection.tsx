"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { OverlayUiWarningSectionVM, OverlayUiWarningRow } from "@/lib/overlay-ui/overlayUiAdapter";
import { OVERLAY_UI_WARNING_DISCLAIMER } from "@/lib/overlay-ui/overlayUiDescription";
import { clipWithHiddenCount, OVERLAY_MAX_VISIBLE_WARNING_GROUPS } from "@/lib/overlay-ui/overlayRenderingBudget";
import { groupOverlayUiWarningRows, type GroupedOverlayWarningRow } from "@/lib/overlay-ui/overlayWarningFocus";
import {
  OverlayUiBadge,
  OverlayUiEmptyHint,
  OverlayUiRowCard,
  OverlayUiRowList,
  OverlayUiSection,
} from "./OverlayUiPrimitives";

function GroupedWarningRow({ g }: { readonly g: GroupedOverlayWarningRow }) {
  return (
    <OverlayUiRowCard>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <OverlayUiBadge tone={g.severityTone}>{g.severityLabel}</OverlayUiBadge>
        <code style={{ fontSize: 11, color: t.textMuted, wordBreak: "break-all" }}>{g.code}</code>
        {g.count > 1 ? (
          <span style={{ fontSize: 11, fontWeight: 800, color: t.textMuted }}>×{g.count}</span>
        ) : null}
      </div>
      <div style={{ lineHeight: 1.5 }}>{g.messageSample}</div>
    </OverlayUiRowCard>
  );
}

function WarningGroupGrouped({
  title,
  rows,
  keyPrefix,
}: {
  readonly title: string;
  readonly rows: readonly OverlayUiWarningRow[];
  readonly keyPrefix: string;
}) {
  const grouped = groupOverlayUiWarningRows(rows);
  const { visible, hiddenCount } = clipWithHiddenCount(grouped, OVERLAY_MAX_VISIBLE_WARNING_GROUPS);
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginBottom: 4 }}>{title}</div>
      {visible.length ? (
        <OverlayUiRowList>
          {visible.map((g, i) => (
            <GroupedWarningRow key={`${keyPrefix}-${g.code}-${i}`} g={g} />
          ))}
        </OverlayUiRowList>
      ) : null}
      {hiddenCount > 0 ? (
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginTop: 4 }}>
          추가 {hiddenCount}건 숨김
        </div>
      ) : null}
    </div>
  );
}

export function OverlayWarningSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayUiWarningSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection title="경고" description={OVERLAY_UI_WARNING_DISCLAIMER} defaultOpen={defaultOpen}>
      {!vm.hasData ? (
        <OverlayUiEmptyHint message="현재 시점에 충돌·정책 기준 차이 경고가 감지되지 않았습니다." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <WarningGroupGrouped
            title={`충돌 가능성 — ${vm.conflictDescription}`}
            rows={vm.conflictRows}
            keyPrefix="cf"
          />
          <WarningGroupGrouped
            title={`정책 기준 차이 — ${vm.driftDescription}`}
            rows={vm.driftRows}
            keyPrefix="dr"
          />
        </div>
      )}
    </OverlayUiSection>
  );
}
