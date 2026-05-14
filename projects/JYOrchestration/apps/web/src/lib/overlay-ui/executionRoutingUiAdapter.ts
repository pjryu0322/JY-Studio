/**
 * Harness Phase H5 Preparation — **Execution Routing UI adapter**.
 *
 * `ExecutionRoutingPlan` → 사용자 표현 ViewModel. 순수 함수, read-only display.
 *
 * 사용자에게 "실제 실행 강제" 같은 과장 표현 금지. **planning/diagnostic** 표현 유지.
 */

import type {
  ExecutionCapability,
  ExecutionProviderType,
  ExecutionRoutingFinding,
  ExecutionRoutingFindingSeverity,
  ExecutionRoutingPlan,
  ExecutionRoutingPlanItem,
} from "@/lib/harness/executionRouting/executionCapabilityTypes";
import { OVERLAY_UI_MISSING_LABEL, formatKoreanInt } from "@/lib/overlay-ui/overlayUiFormat";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";

/** "실제 실행 강제가 아니라 계획 정보"임을 노출하는 공식 안내 문구. */
export const EXECUTION_ROUTING_PLAN_DISCLAIMER =
  "이 정보는 실제 실행 강제가 아니라, 현재 역할 기준으로 어떤 실행 capability를 고려하는지 보여주는 계획 정보입니다.";

const CAPABILITY_LABEL: Readonly<Record<ExecutionCapability, string>> = {
  planning: "기획",
  analysis: "분석",
  architecture_review: "아키텍처 리뷰",
  design_review: "설계 리뷰",
  code_generation: "코드 생성",
  code_review: "코드 리뷰",
  security_review: "보안 리뷰",
  quality_review: "품질 리뷰",
  deployment_review: "배포 리뷰",
  cursor_execution: "Cursor 실행",
  github_operation: "GitHub 작업",
};

const PROVIDER_LABEL: Readonly<Record<ExecutionProviderType, string>> = {
  openai: "OpenAI",
  cursor: "Cursor",
  github: "GitHub",
  unknown: "미지정",
};

const PROVIDER_TONE: Readonly<Record<ExecutionProviderType, OverlayUiBadgeTone>> = {
  openai: "info",
  cursor: "positive",
  github: "neutral",
  unknown: "warning",
};

const SEVERITY_LABEL: Readonly<Record<ExecutionRoutingFindingSeverity, string>> = {
  info: "안내",
  warning: "주의",
};

export function executionRoutingCapabilityLabel(capability: ExecutionCapability): string {
  return CAPABILITY_LABEL[capability] ?? capability;
}

export function executionRoutingProviderLabel(provider: ExecutionProviderType): string {
  return PROVIDER_LABEL[provider] ?? provider;
}

export function executionRoutingProviderTone(provider: ExecutionProviderType): OverlayUiBadgeTone {
  return PROVIDER_TONE[provider] ?? "neutral";
}

export function executionRoutingFindingSeverityLabel(
  severity: ExecutionRoutingFindingSeverity
): string {
  return SEVERITY_LABEL[severity] ?? "안내";
}

export type ExecutionRoutingPlanItemVM = Readonly<{
  roleKey: string;
  capability: ExecutionCapability;
  capabilityLabel: string;
  provider: ExecutionProviderType;
  providerLabel: string;
  providerTone: OverlayUiBadgeTone;
  enabled: boolean;
  enabledLabel: string;
  enabledTone: OverlayUiBadgeTone;
  reasonLabel: string;
  warningLabel?: string;
}>;

export type ExecutionRoutingFindingVM = Readonly<{
  code: string;
  severity: ExecutionRoutingFindingSeverity;
  severityLabel: string;
  message: string;
}>;

export type ExecutionRoutingPlanVM = Readonly<{
  hasData: boolean;
  disclaimer: string;
  /** Header row 표시 값(label 텍스트는 prefix 없이 순수 value). */
  roleValue: string;
  stageValue: string;
  totalLabel: string;
  enabledLabel: string;
  disabledLabel: string;
  providerBreakdownText: string;
  capabilityBreakdownText: string;
  unsupportedWarning: {
    readonly visible: boolean;
    readonly label: string;
    readonly tone: OverlayUiBadgeTone;
  };
  items: readonly ExecutionRoutingPlanItemVM[];
  findings: readonly ExecutionRoutingFindingVM[];
}>;

function toItemVM(item: ExecutionRoutingPlanItem): ExecutionRoutingPlanItemVM {
  return {
    roleKey: item.roleKey,
    capability: item.capability,
    capabilityLabel: executionRoutingCapabilityLabel(item.capability),
    provider: item.provider,
    providerLabel: executionRoutingProviderLabel(item.provider),
    providerTone: executionRoutingProviderTone(item.provider),
    enabled: item.enabled,
    enabledLabel: item.enabled ? "가능" : "불가",
    enabledTone: item.enabled ? "positive" : "warning",
    reasonLabel: `사유: ${item.reason}`,
    ...(item.warning ? { warningLabel: item.warning } : {}),
  };
}

function toFindingVM(f: ExecutionRoutingFinding): ExecutionRoutingFindingVM {
  return {
    code: f.code,
    severity: f.severity,
    severityLabel: executionRoutingFindingSeverityLabel(f.severity),
    message: f.message,
  };
}

function buildBreakdownText<T extends string>(
  items: readonly { readonly key: T }[],
  toLabel: (key: T) => string
): string {
  if (!items.length) return "후보 없음";
  const counts = new Map<T, number>();
  for (const item of items) {
    counts.set(item.key, (counts.get(item.key) ?? 0) + 1);
  }
  const parts = Array.from(counts.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, n]) => `${toLabel(k)} ${formatKoreanInt(n)}`);
  return parts.join(" · ");
}

/**
 * `ExecutionRoutingPlan` → UI VM.
 *
 * - plan이 null/undefined 또는 mode 잘못 → `hasData: false` 안전 fallback.
 */
export function buildExecutionRoutingPlanVM(
  plan: ExecutionRoutingPlan | null | undefined
): ExecutionRoutingPlanVM {
  const safe = plan && plan.mode === "dry_run" ? plan : null;
  if (!safe) {
    return {
      hasData: false,
      disclaimer: EXECUTION_ROUTING_PLAN_DISCLAIMER,
      roleValue: OVERLAY_UI_MISSING_LABEL,
      stageValue: OVERLAY_UI_MISSING_LABEL,
      totalLabel: "후보 0개",
      enabledLabel: "가능 0",
      disabledLabel: "불가 0",
      providerBreakdownText: "후보 없음",
      capabilityBreakdownText: "후보 없음",
      unsupportedWarning: { visible: false, label: "", tone: "neutral" },
      items: [],
      findings: [],
    };
  }

  let enabledCount = 0;
  let disabledCount = 0;
  for (const item of safe.items) {
    if (item.enabled) enabledCount += 1;
    else disabledCount += 1;
  }

  const providerKeys = safe.items.map((item) => ({ key: item.provider }));
  const capabilityKeys = safe.items.map((item) => ({ key: item.capability }));

  return {
    hasData: safe.items.length > 0 || safe.findings.length > 0,
    disclaimer: EXECUTION_ROUTING_PLAN_DISCLAIMER,
    roleValue: safe.roleKey?.length ? safe.roleKey : OVERLAY_UI_MISSING_LABEL,
    stageValue: safe.workspaceStage?.length ? safe.workspaceStage : OVERLAY_UI_MISSING_LABEL,
    totalLabel: `후보 ${formatKoreanInt(safe.items.length)}개`,
    enabledLabel: `가능 ${formatKoreanInt(enabledCount)}`,
    disabledLabel: `불가 ${formatKoreanInt(disabledCount)}`,
    providerBreakdownText: buildBreakdownText(providerKeys, executionRoutingProviderLabel),
    capabilityBreakdownText: buildBreakdownText(capabilityKeys, executionRoutingCapabilityLabel),
    unsupportedWarning:
      disabledCount > 0
        ? {
            visible: true,
            label: `provider matrix가 지원하지 않는 capability ${formatKoreanInt(disabledCount)}건이 감지되었습니다. 실제 실행에는 영향이 없습니다.`,
            tone: "warning",
          }
        : { visible: false, label: "", tone: "neutral" },
    items: safe.items.map(toItemVM),
    findings: safe.findings.map(toFindingVM),
  };
}
