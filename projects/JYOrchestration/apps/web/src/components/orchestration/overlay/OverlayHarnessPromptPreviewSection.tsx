"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildHarnessPromptPreviewVM } from "@/lib/overlay-ui/harnessPromptPreviewUiAdapter";
import {
  OverlayUiBadge,
  OverlayUiEmptyHint,
  OverlayUiKeyValueRow,
  OverlayUiRowCard,
  OverlayUiRowList,
  OverlayUiSection,
  OverlayUiSourceText,
  OverlayUiWarningList,
} from "./OverlayUiPrimitives";

/**
 * Harness Phase H1 — Prompt Timeline Overlay 탭 안의 **Harness Prompt Preview** 섹션.
 *
 * **dry-run / read-only display.** 실제 LLM 호출에 사용된 prompt가 아님을 상단에 명시한다.
 *
 * 기본 펼침 상태는 `defaultOpen` prop으로 제어(SummaryCard에서 정책 전달).
 */
export function OverlayHarnessPromptPreviewSection({
  overlay,
  defaultOpen,
}: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly defaultOpen?: boolean;
}) {
  const vm = buildHarnessPromptPreviewVM({
    preview: overlay?.harnessPromptAssemblyPreview,
    diff: overlay?.harnessPromptPreviewDiff,
  });
  return (
    <OverlayUiSection
      title="Harness Prompt Preview"
      description={vm.disclaimer}
      defaultOpen={defaultOpen}
    >
      {!vm.hasData ? (
        <OverlayUiEmptyHint
          message="Harness preview가 기록되지 않았습니다."
          secondary="최근 AI 응답부터 dry-run preview가 함께 기록됩니다."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <PreviewHeader vm={vm} />
          <OverlayUiWarningList warnings={vm.warnings} ariaLabel="Harness preview 경고" />
          <OverlayUiRowList>
            {vm.sectionRows.map((row) => (
              <OverlayUiRowCard key={row.id} layout={{ gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <strong style={{ color: t.textPrimary }}>{row.title}</strong>
                  <OverlayUiBadge tone="info" title="Harness 표준 섹션 분류">
                    {row.typeLabel}
                  </OverlayUiBadge>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: t.textMuted }}>
                    {row.estimatedCostLabel}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: t.textMuted,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 4,
                    minWidth: 0,
                  }}
                >
                  <span style={{ flexShrink: 0 }}>출처:</span>
                  <OverlayUiSourceText source={row.source} />
                </div>
                {row.includeReason ? (
                  <div style={{ fontSize: 11, color: t.textMuted }}>참조 사유: {row.includeReason}</div>
                ) : null}
                {row.contentPreview ? (
                  <pre
                    style={{
                      margin: 0,
                      padding: "6px 8px",
                      background: "#f8fafc",
                      border: `1px solid ${t.border}`,
                      borderRadius: 6,
                      fontSize: 11,
                      color: t.textSecondary,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: 120,
                      overflow: "auto",
                    }}
                  >
                    {row.contentPreview}
                  </pre>
                ) : null}
              </OverlayUiRowCard>
            ))}
          </OverlayUiRowList>
          {vm.diff.hasData ? <PreviewDiff diff={vm.diff} /> : null}
        </div>
      )}
    </OverlayUiSection>
  );
}

function PreviewHeader({ vm }: { readonly vm: ReturnType<typeof buildHarnessPromptPreviewVM> }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 12, fontWeight: 900, color: t.textPrimary }}>Preview 요약</strong>
        <OverlayUiBadge tone="neutral" title="실제 LLM 호출이 아닌 dry-run 결과">
          {vm.modeLabel}
        </OverlayUiBadge>
        <OverlayUiBadge tone={vm.overflowRiskTone} title="토큰 예산 과부하 위험(휴리스틱)">
          예산 위험 {vm.overflowRiskLabel}
        </OverlayUiBadge>
      </div>
      <OverlayUiKeyValueRow label="섹션 수" value={vm.sectionCountLabel} />
      <OverlayUiKeyValueRow label="추정 비용 합계" value={vm.totalEstimatedCostLabel} />
    </div>
  );
}

function PreviewDiff({
  diff,
}: {
  readonly diff: ReturnType<typeof buildHarnessPromptPreviewVM>["diff"];
}) {
  return (
    <div
      style={{
        background: "#f1f5f9",
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <strong style={{ fontSize: 12, fontWeight: 900, color: t.textPrimary }}>기존 prompt 대비</strong>
      <OverlayUiKeyValueRow label="기존 prompt 길이" value={diff.existingPromptLengthLabel} />
      <OverlayUiKeyValueRow label="Preview 길이" value={diff.previewLengthLabel} />
      <OverlayUiKeyValueRow label="섹션 수" value={diff.sectionCountLabel} />
      {diff.missingSectionLabels.length > 0 ? (
        <OverlayUiKeyValueRow
          label="누락 섹션"
          value={diff.missingSectionLabels.join(", ")}
        />
      ) : null}
      {diff.extraSectionLabels.length > 0 ? (
        <OverlayUiKeyValueRow
          label="추가 섹션"
          value={diff.extraSectionLabels.join(", ")}
        />
      ) : null}
      <OverlayUiWarningList warnings={diff.warnings} ariaLabel="Harness preview diff 경고" />
    </div>
  );
}
