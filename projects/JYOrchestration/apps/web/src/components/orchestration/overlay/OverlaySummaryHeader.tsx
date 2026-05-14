"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { OverlayUiSummaryHeaderVM } from "@/lib/overlay-ui/overlayUiAdapter";
import { OverlayUiBadge, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";

/**
 * "AI 판단 요약" 헤더 — Overlay 탭 상단에 노출되어 운영자가 한눈에 상태를 파악하게 한다.
 *
 * **read-only display**. 모든 라벨은 사용자 표현으로 변환된 ViewModel을 입력으로 받는다.
 * 내부 enum/code(`overflowRisk`/`includeMode`/`pruningCandidate` 등)는 직접 노출되지 않는다.
 */
export function OverlaySummaryHeader({ vm }: { readonly vm: OverlayUiSummaryHeaderVM }) {
  return (
    <section
      aria-label="AI 판단 요약"
      style={{
        background: "#f8fafc",
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: 12, fontWeight: 900, color: t.textPrimary }}>AI 판단 요약</strong>
        <span style={{ fontSize: 11, color: t.textMuted }}>
          이 화면은 운영 진단용 계획 정보입니다.
        </span>
      </div>

      <OverlayUiKeyValueRow
        label="역할"
        value={vm.roleLabel ?? "ㅡ"}
      />
      <OverlayUiKeyValueRow
        label="맥락 수"
        value={
          <>
            <span>선택 {vm.selectedContextCount}</span>
            {vm.prioritizedContextCount > 0 ? (
              <span style={{ color: t.textMuted }}> · 우선순위 {vm.prioritizedContextCount}</span>
            ) : null}
          </>
        }
      />
      <OverlayUiKeyValueRow
        label="예산 위험"
        value={vm.overflowRiskLabel}
        badge={
          <OverlayUiBadge tone={vm.overflowRiskTone} title="토큰 예산 과부하 위험(휴리스틱)">
            {vm.overflowRiskLabel}
          </OverlayUiBadge>
        }
      />
      <OverlayUiKeyValueRow label="경고" value={`${vm.warningCount}건`} />
      <OverlayUiKeyValueRow label="축소 후보" value={`${vm.pruningCandidateCount}건`} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
        {vm.assemblyIncludeModeCounts.required > 0 ? (
          <OverlayUiBadge tone="info" title="핵심 맥락으로 우선 참조(계획)">
            핵심 {vm.assemblyIncludeModeCounts.required}
          </OverlayUiBadge>
        ) : null}
        {vm.assemblyIncludeModeCounts.recommended > 0 ? (
          <OverlayUiBadge tone="neutral" title="추천 맥락(계획)">
            추천 {vm.assemblyIncludeModeCounts.recommended}
          </OverlayUiBadge>
        ) : null}
        {vm.assemblyIncludeModeCounts.optional > 0 ? (
          <OverlayUiBadge tone="neutral" title="선택 맥락(계획)">
            선택 {vm.assemblyIncludeModeCounts.optional}
          </OverlayUiBadge>
        ) : null}
        {vm.assemblyIncludeModeCounts.excludeCandidate > 0 ? (
          <OverlayUiBadge tone="warning" title="축소 후보(계획)">
            축소 후보 {vm.assemblyIncludeModeCounts.excludeCandidate}
          </OverlayUiBadge>
        ) : null}
      </div>
    </section>
  );
}
