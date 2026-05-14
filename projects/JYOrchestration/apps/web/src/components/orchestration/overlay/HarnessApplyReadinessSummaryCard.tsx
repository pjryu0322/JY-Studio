"use client";

/**
 * Harness Phase H2 — Prompt Timeline 상단에 표시되는 **Apply-readiness summary card**.
 *
 * **read-only / 진단 metadata only.** 실제 prompt payload·LLM 호출과 무관.
 *
 * 사용자에게 "적용 가능"이라는 단정 표현을 노출하지 않으며, `ready_candidate`도
 * "적용 후보"로만 표기한다. 적용 버튼 등 enforcement 액션은 없다.
 */

import { uiTokens as t } from "@/components/ui/tokens";
import {
  HARNESS_PROMPT_APPLY_READINESS_DISCLAIMER,
  buildHarnessPromptApplyReadinessVM,
} from "@/lib/overlay-ui/harnessPromptApplyReadinessUiAdapter";
import type { HarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import {
  OverlayUiBadge,
  OverlayUiFindingList,
  OverlayUiKeyValueRow,
} from "@/components/orchestration/overlay/OverlayUiPrimitives";

export function HarnessApplyReadinessSummaryCard({
  report,
}: {
  readonly report: HarnessPromptApplyReadinessReport | null | undefined;
}) {
  const vm = buildHarnessPromptApplyReadinessVM(report);
  return (
    <section
      aria-label="Harness 적용 준비도"
      style={{
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        background: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 12, fontWeight: 900, color: t.textPrimary }}>
          Harness 적용 준비도
        </strong>
        <OverlayUiBadge tone={vm.levelTone} title={vm.thresholdsHelpText}>
          {vm.levelLabel}
        </OverlayUiBadge>
        <span
          style={{ marginLeft: "auto", fontSize: 11, color: t.textMuted }}
          title={HARNESS_PROMPT_APPLY_READINESS_DISCLAIMER}
        >
          dry-run 진단
        </span>
      </div>
      <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
        {HARNESS_PROMPT_APPLY_READINESS_DISCLAIMER}
      </div>
      {!vm.hasData ? (
        <div
          style={{
            background: "#fff",
            border: `1px dashed ${t.border}`,
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 11,
            color: t.textMuted,
            lineHeight: 1.5,
          }}
          role="status"
          aria-live="polite"
        >
          평가에 사용할 최근 AI 응답이 충분하지 않습니다. 응답이 누적되면 자동으로 갱신됩니다.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <OverlayUiKeyValueRow label="샘플 / Preview" value={`${vm.sampledEntryCountLabel} / ${vm.previewEntryCountLabel}`} />
          <OverlayUiKeyValueRow label="누락 섹션 비율" value={vm.missingSectionRateLabel} />
          <OverlayUiKeyValueRow label="맥락 과다 위험 높음 비율" value={vm.highOverflowRiskRateLabel} />
          <OverlayUiKeyValueRow label="경고 발생 비율" value={vm.warningRateLabel} />
          <OverlayUiKeyValueRow
            label="평균 기존 / Preview 길이"
            value={`${vm.averageExistingPromptLengthLabel} / ${vm.averagePreviewLengthLabel}`}
          />
        </div>
      )}
      <OverlayUiFindingList findings={vm.findings} ariaLabel="Harness 적용 준비도 진단" />
    </section>
  );
}
