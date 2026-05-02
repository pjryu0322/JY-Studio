"use client";

import { RequirementsChatHeaderRow } from "@/components/requirements/RequirementsChatHeaderRow";
import { uiTokens as t } from "@/components/ui/tokens";

export function ServiceFlowHeader(p: {
  readonly progressPercent: number;
  /** 결정 슬롯 충족 수(아이디어 정리도의 분자·분모 중 분자에 대응) */
  readonly filledSlotCount: number;
  readonly progressSlotTotal: number;
  readonly onOpenRemaining: () => void;
  readonly hint?: string | null;
  readonly memberControls?: { readonly count: number; readonly onOpen: () => void } | null;
}) {
  const membersUi = p.memberControls ?? null;

  return (
    <RequirementsChatHeaderRow
      memberControls={membersUi}
      leading={
        <button
          type="button"
          onClick={() => p.onOpenRemaining()}
          title={p.hint?.trim() ? p.hint ?? undefined : "남은 결정사항 보기"}
          style={{
            border: `1px solid ${t.borderStrong}`,
            background: t.bgCard,
            borderRadius: 999,
            padding: "6px 10px",
            fontSize: 12,
            fontWeight: 900,
            color: t.textPrimary,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            maxWidth: "min(100%, 360px)",
          }}
        >
          <span style={{ whiteSpace: "nowrap" }}>흐름 설계도 {p.progressPercent}%</span>
          <span style={{ color: t.textMuted, fontWeight: 900 }}>·</span>
          <span style={{ whiteSpace: "nowrap", color: t.textSecondary }}>
            {p.filledSlotCount}/{p.progressSlotTotal}
          </span>
        </button>
      }
    />
  );
}
