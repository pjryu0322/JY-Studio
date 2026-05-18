"use client";

import type {
  HarnessMaturityBaselineReport,
  HarnessReleaseGateReadinessReport,
} from "@/lib/harness/maturity/harnessMaturityTypes";
import { buildHarnessMaturityUiViewModel } from "@/lib/overlay-ui/harnessMaturityUiAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection } from "./OverlayUiPrimitives";

export function OverlayHarnessMaturitySection({
  baseline,
  releaseGate,
  defaultOpen,
}: {
  readonly baseline: HarnessMaturityBaselineReport | null | undefined;
  readonly releaseGate: HarnessReleaseGateReadinessReport | null | undefined;
  readonly defaultOpen?: boolean;
}) {
  const vm = buildHarnessMaturityUiViewModel(baseline, releaseGate);
  return (
    <OverlayUiSection title="Harness Runtime Maturity (H8)" description={vm.diagnosticDisclaimer} defaultOpen={defaultOpen}>
      {!vm.hasData ? (
        <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
          Maturity baseline을 계산할 입력이 없습니다. 프로젝트 타임라인 또는 Overlay 메타가 연결되면 표시됩니다.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: t.textPrimary, fontWeight: 800 }}>
            종합: {vm.overallLabel}
            <span style={{ fontWeight: 600, color: t.textMuted, marginLeft: 8 }}>{vm.countsLabel}</span>
          </div>
          <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.5 }}>
            사용자 요약 노출: <strong>{vm.userVisibleSummaryLabel}</strong>
            {" · "}
            통제 시험 후보(전 계층 read-only 준비): <strong>{vm.controlledTrialLabel}</strong>
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: t.textPrimary,
              borderTop: `1px solid ${t.border}`,
              paddingTop: 8,
            }}
          >
            Release gate readiness: {vm.releaseGateLevelLabel}
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            금지 플래그(고정 false):{" "}
            {vm.forbiddenFlags.map((f) => (
              <span key={f.label} style={{ marginRight: 10 }}>
                {f.label}={f.value}
              </span>
            ))}
          </div>
          {vm.releaseGateBlockers.length ? (
            <div style={{ fontSize: 11, color: "#92400e", lineHeight: 1.45 }}>
              <strong>블로커</strong>
              <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                {vm.releaseGateBlockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {vm.releaseGateRecommendations.length ? (
            <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.45 }}>
              <strong>권장</strong>
              <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                {vm.releaseGateRecommendations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>계층별 상태</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {vm.layerRows.map((row) => (
              <div
                key={row.layerLabel}
                style={{
                  fontSize: 11,
                  lineHeight: 1.45,
                  color: t.textSecondary,
                  borderLeft: "3px solid #cbd5e1",
                  paddingLeft: 8,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontWeight: 800, color: t.textPrimary }}>{row.layerLabel}</span>
                <span>{row.statusLabel}</span>
                <span style={{ color: t.textMuted }}>· 노출: {row.exposureLabel}</span>
              </div>
            ))}
          </div>
          {vm.findings.length ? (
            <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
              <strong>Findings</strong>
              <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                {vm.findings.map((f, i) => (
                  <li key={`${f.severity}-${i}-${f.message.slice(0, 40)}`}>
                    [{f.severity}] {f.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </OverlayUiSection>
  );
}
