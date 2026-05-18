"use client";

/**
 * Harness Phase H5 / H5.5 — **Overlay Execution Routing Section**.
 *
 * Prompt Timeline Overlay 탭에서 "이번 턴에 어떤 역할이 어떤 capability를 어느 provider로
 * 처리할 수 있는지(H5)" + "그 routing plan의 dry-run safety 진단(H5.5)"을 함께 표시한다.
 *
 * **read-only / planning + dry-run safety diagnostic.** 실제 provider switching·execution은 수행하지 않는다.
 */

import type { ReactNode } from "react";

import { uiTokens as t } from "@/components/ui/tokens";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import {
  buildExecutionRoutingPlanVM,
  buildExecutionRoutingSafetyVM,
  type ExecutionRoutingSafetyFlagVM,
  type ExecutionRoutingSafetyVM,
} from "@/lib/overlay-ui/executionRoutingUiAdapter";
import {
  OverlayUiBadge,
  OverlayUiEmptyHint,
  OverlayUiFindingList,
  OverlayUiKeyValueRow,
  OverlayUiNoticeBanner,
  OverlayUiRowCard,
  OverlayUiRowList,
  OverlayUiSection,
  OverlayUiSourceText,
} from "./OverlayUiPrimitives";

export function OverlayExecutionRoutingSection({
  overlay,
  defaultOpen,
}: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly defaultOpen?: boolean;
}) {
  const vm = buildExecutionRoutingPlanVM(overlay?.executionRoutingPlan ?? null);
  const safetyVM = buildExecutionRoutingSafetyVM(overlay?.executionRoutingSafetyReport ?? null);
  return (
    <OverlayUiSection
      title="Execution Routing Plan"
      description={vm.disclaimer}
      defaultOpen={defaultOpen}
    >
      <SafetyBlock vm={safetyVM} />
      {!vm.hasData ? (
        <OverlayUiEmptyHint
          message="이번 턴에 대해 기록된 execution routing 후보가 없습니다."
          secondary="역할과 provider 정보가 정리되면 자동으로 후보가 보강됩니다."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <PlanHeader vm={vm} />
          {vm.unsupportedWarning.visible ? (
            <OverlayUiNoticeBanner
              variant="warning"
              message={vm.unsupportedWarning.label}
              ariaLabel="Execution Routing 미지원 capability 경고"
              badge={
                <OverlayUiBadge tone={vm.unsupportedWarning.tone} title="unsupported capability">
                  주의
                </OverlayUiBadge>
              }
            />
          ) : null}
          <OverlayUiFindingList findings={vm.findings} ariaLabel="Execution Routing 진단" />
          <OverlayUiRowList>
            {vm.items.map((item) => (
              <OverlayUiRowCard key={`${item.roleKey}|${item.capability}|${item.provider}`} layout={{ gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <strong style={{ color: t.textPrimary }}>
                    <OverlayUiSourceText source={`${item.roleKey} · ${item.capabilityLabel}`} />
                  </strong>
                  <OverlayUiBadge tone={item.providerTone} title="추천 provider">
                    {item.providerLabel}
                  </OverlayUiBadge>
                  <OverlayUiBadge tone={item.enabledTone} title="provider 지원 여부">
                    {item.enabledLabel}
                  </OverlayUiBadge>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: t.textMuted,
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span>{item.reasonLabel}</span>
                  {item.warningLabel ? <span>경고: {item.warningLabel}</span> : null}
                </div>
              </OverlayUiRowCard>
            ))}
          </OverlayUiRowList>
        </div>
      )}
    </OverlayUiSection>
  );
}

function PlanHeader({ vm }: { readonly vm: ReturnType<typeof buildExecutionRoutingPlanVM> }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <OverlayUiKeyValueRow label="역할" value={vm.roleValue} />
      <OverlayUiKeyValueRow label="단계" value={vm.stageValue} />
      <OverlayUiKeyValueRow
        label="후보 / 지원 여부"
        value={`${vm.totalLabel} · ${vm.enabledLabel} · ${vm.disabledLabel}`}
      />
      <OverlayUiKeyValueRow label="provider 분포" value={vm.providerBreakdownText} />
      <OverlayUiKeyValueRow label="capability 분포" value={vm.capabilityBreakdownText} />
    </div>
  );
}

function SafetyBlock({ vm }: { readonly vm: ExecutionRoutingSafetyVM }): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <strong style={{ color: t.textPrimary, fontSize: 12 }}>Safety</strong>
        <OverlayUiBadge tone={vm.statusTone} title="safety status">
          {vm.statusLabel}
        </OverlayUiBadge>
        <span style={{ fontSize: 11, color: t.textMuted }}>{vm.summaryLine}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {vm.flags.map((flag) => (
          <SafetyFlagBadge key={flag.label} flag={flag} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>{vm.disclaimer}</div>
      <OverlayUiFindingList findings={vm.findings} ariaLabel="Execution Routing 안전 진단" />
    </div>
  );
}

function SafetyFlagBadge({ flag }: { readonly flag: ExecutionRoutingSafetyFlagVM }) {
  return (
    <OverlayUiBadge tone={flag.tone} title={`${flag.label} ${flag.stateLabel}`}>
      {flag.label} {flag.stateLabel}
    </OverlayUiBadge>
  );
}
