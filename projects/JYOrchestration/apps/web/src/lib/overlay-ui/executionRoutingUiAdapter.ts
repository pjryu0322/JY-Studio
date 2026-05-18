/**
 * Harness Phase H5 / H5.5 — **Execution Routing UI adapter**.
 *
 * `ExecutionRoutingPlan` + `ExecutionRoutingSafetyReport` → 사용자 표현 ViewModel.
 * 순수 함수, read-only display.
 *
 * 사용자에게 "실제 실행 강제" 같은 과장 표현 금지. **planning / dry-run safety diagnostic** 표현 유지.
 */

import type {
  ExecutionCapability,
  ExecutionProviderType,
  ExecutionRoutingFinding,
  ExecutionRoutingFindingSeverity,
  ExecutionRoutingPlan,
  ExecutionRoutingPlanItem,
} from "@/lib/harness/executionRouting/executionCapabilityTypes";
import type {
  ExecutionRoutingSafetyFinding,
  ExecutionRoutingSafetyFindingSeverity,
  ExecutionRoutingSafetyReport,
  ExecutionRoutingSafetyStatus,
} from "@/lib/harness/executionRouting/executionRoutingSafetyTypes";
import type { RecentExecutionRoutingSummary } from "@/lib/harness/executionRouting/executionRoutingRecentSummary";
import { OVERLAY_UI_MISSING_LABEL, formatKoreanInt } from "@/lib/overlay-ui/overlayUiFormat";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";

/** "실제 실행 강제가 아니라 계획 정보"임을 노출하는 공식 안내 문구. */
export const EXECUTION_ROUTING_PLAN_DISCLAIMER =
  "이 정보는 실제 실행 경로가 아니라, 현재 역할 기준으로 고려 가능한 실행 capability 계획입니다.";

/** Safety 섹션 disclaimer(plan disclaimer와 짝). */
export const EXECUTION_ROUTING_SAFETY_DISCLAIMER =
  "이 보고서는 실제 실행 경로가 아니라, 현재 역할 기준으로 고려 가능한 실행 capability 계획에 대한 안전 진단입니다. provider 자동 전환·실행 차단·자동 실행은 모두 비활성화되어 있습니다.";

/** 내부 reason key → 사용자 표현 라벨(H5.5 요구사항 §7). */
const REASON_LABEL_RULES: ReadonlyArray<{
  readonly prefix: string;
  readonly toLabel: (rest: string) => string;
}> = [
  {
    prefix: "role_policy_recommended:",
    toLabel: (rest) =>
      `역할 정책상 추천 (${executionRoutingProviderLabel(rest as ExecutionProviderType)})`,
  },
  {
    prefix: "provider_hint_matched:",
    toLabel: (rest) =>
      `외부 힌트와 일치 (${executionRoutingProviderLabel(rest as ExecutionProviderType)})`,
  },
  {
    prefix: "provider_hint_unsupported:",
    toLabel: (rest) =>
      `외부 힌트와 capability 불일치 (${executionRoutingProviderLabel(rest as ExecutionProviderType)})`,
  },
];

/** raw reason → 사용자 친화적 라벨(접두사 prefix 매칭 + fallback). */
export function executionRoutingReasonLabel(reason: string): string {
  const trimmed = String(reason ?? "").trim();
  if (!trimmed) return "사유 미지정";
  for (const rule of REASON_LABEL_RULES) {
    if (trimmed.startsWith(rule.prefix)) {
      return rule.toLabel(trimmed.slice(rule.prefix.length).trim());
    }
  }
  if (trimmed === "no_provider_recommendation") return "추천 provider 없음";
  return trimmed;
}

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

const SAFETY_FINDING_SEVERITY_LABEL: Readonly<
  Record<ExecutionRoutingSafetyFindingSeverity, string>
> = {
  info: "안내",
  warning: "주의",
};

const SAFETY_STATUS_LABEL: Readonly<Record<ExecutionRoutingSafetyStatus, string>> = {
  safe_dry_run: "안전한 미리보기",
  watch: "관찰 필요",
  unsafe_to_apply: "적용 부적합",
};

const SAFETY_STATUS_TONE: Readonly<Record<ExecutionRoutingSafetyStatus, OverlayUiBadgeTone>> = {
  safe_dry_run: "positive",
  watch: "warning",
  unsafe_to_apply: "danger",
};

export function executionRoutingSafetyStatusLabel(
  status: ExecutionRoutingSafetyStatus
): string {
  return SAFETY_STATUS_LABEL[status] ?? "안내";
}

export function executionRoutingSafetyStatusTone(
  status: ExecutionRoutingSafetyStatus
): OverlayUiBadgeTone {
  return SAFETY_STATUS_TONE[status] ?? "neutral";
}

export function executionRoutingSafetyFindingSeverityLabel(
  severity: ExecutionRoutingSafetyFindingSeverity
): string {
  return SAFETY_FINDING_SEVERITY_LABEL[severity] ?? "안내";
}

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
    reasonLabel: `사유: ${executionRoutingReasonLabel(item.reason)}`,
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

// ── H5.5 Safety VM ─────────────────────────────────────────────────────

export type ExecutionRoutingSafetyFindingVM = Readonly<{
  code: string;
  severity: ExecutionRoutingSafetyFindingSeverity;
  severityLabel: string;
  message: string;
}>;

export type ExecutionRoutingSafetyFlagVM = Readonly<{
  /** 일관된 short label(예: "Provider 자동 전환"). */
  label: string;
  /** 비활성/활성 상태를 사용자 표현으로 노출(`"안 함"` 등). */
  stateLabel: string;
  /** badge tone — 모두 `false` 고정이므로 항상 `positive`(안전 상태). */
  tone: OverlayUiBadgeTone;
}>;

export type ExecutionRoutingSafetyVM = Readonly<{
  /** 데이터 유무. safety report가 null이면 false. */
  hasData: boolean;
  disclaimer: string;
  statusLabel: string;
  statusTone: OverlayUiBadgeTone;
  status: ExecutionRoutingSafetyStatus;
  summaryLine: string;
  /** "Provider 자동 전환 안 함" 등 비활성 플래그를 사용자 표현으로 노출. */
  flags: readonly ExecutionRoutingSafetyFlagVM[];
  findings: readonly ExecutionRoutingSafetyFindingVM[];
}>;

function toSafetyFindingVM(f: ExecutionRoutingSafetyFinding): ExecutionRoutingSafetyFindingVM {
  return {
    code: f.code,
    severity: f.severity,
    severityLabel: executionRoutingSafetyFindingSeverityLabel(f.severity),
    message: f.message,
  };
}

/**
 * `ExecutionRoutingSafetyReport` → 사용자 표현 VM.
 *
 * - report가 null/mode 잘못 → `hasData: false` 안전 fallback.
 * - flags는 `providerSwitchingEnabled`/`executionBlockingEnabled`/`automaticExecutionEnabled`를
 *   사용자 표현(`"Provider 자동 전환 안 함"` 등)으로 변환.
 */
export function buildExecutionRoutingSafetyVM(
  report: ExecutionRoutingSafetyReport | null | undefined
): ExecutionRoutingSafetyVM {
  const safe = report && report.mode === "dry_run_safety" ? report : null;
  const baseFlags: readonly ExecutionRoutingSafetyFlagVM[] = [
    { label: "Provider 자동 전환", stateLabel: "안 함", tone: "positive" },
    { label: "실행 차단", stateLabel: "안 함", tone: "positive" },
    { label: "자동 실행", stateLabel: "안 함", tone: "positive" },
  ];
  if (!safe) {
    return {
      hasData: false,
      disclaimer: EXECUTION_ROUTING_SAFETY_DISCLAIMER,
      statusLabel: executionRoutingSafetyStatusLabel("safe_dry_run"),
      statusTone: executionRoutingSafetyStatusTone("safe_dry_run"),
      status: "safe_dry_run",
      summaryLine: "전체 0건 · 미지원 0 · 경고 0 · 외부 힌트 0",
      flags: baseFlags,
      findings: [],
    };
  }
  const summaryLine = `전체 ${formatKoreanInt(safe.totalItems)}건 · 미지원 ${formatKoreanInt(
    safe.unsupportedCapabilityCount
  )} · 경고 ${formatKoreanInt(safe.warningItemCount)} · 외부 힌트 ${formatKoreanInt(
    safe.providerHintCount
  )}`;
  return {
    hasData: true,
    disclaimer: EXECUTION_ROUTING_SAFETY_DISCLAIMER,
    statusLabel: executionRoutingSafetyStatusLabel(safe.status),
    statusTone: executionRoutingSafetyStatusTone(safe.status),
    status: safe.status,
    summaryLine,
    flags: baseFlags,
    findings: safe.findings.map(toSafetyFindingVM),
  };
}

// ── H5.5 Recent Routing Trend VM ─────────────────────────────────────────

export type ExecutionRoutingRecentTrendVM = Readonly<{
  hasData: boolean;
  sampleCountLabel: string;
  totalLabel: string;
  disabledRateLabel: string;
  warningRateLabel: string;
  unknownProviderRateLabel: string;
  cursorCapabilityRateLabel: string;
  githubCapabilityRateLabel: string;
  findingRateLabel: string;
}>;

function formatRateLabel(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "0%";
  const pct = Math.round(Math.max(0, Math.min(1, rate)) * 100);
  return `${pct}%`;
}

/**
 * `RecentExecutionRoutingSummary` → 사용자 표현 VM.
 *
 * - sampledEntryCount/planEntryCount/totalItems가 0이면 `hasData: false`.
 * - rate는 0–1 → 0–100% 정수로 포맷.
 */
export function buildExecutionRoutingRecentTrendVM(
  summary: RecentExecutionRoutingSummary | null | undefined
): ExecutionRoutingRecentTrendVM {
  const safe = summary ?? null;
  const hasData =
    !!safe &&
    (safe.sampledEntryCount > 0 || safe.planEntryCount > 0 || safe.totalItems > 0);
  return {
    hasData,
    sampleCountLabel: `샘플 ${formatKoreanInt(safe?.sampledEntryCount ?? 0)}건 · 유효 plan ${formatKoreanInt(safe?.planEntryCount ?? 0)}건`,
    totalLabel: `총 routing 후보 ${formatKoreanInt(safe?.totalItems ?? 0)}건`,
    disabledRateLabel: `미지원 비율 ${formatRateLabel(safe?.disabledItemRate ?? 0)}`,
    warningRateLabel: `경고 비율 ${formatRateLabel(safe?.warningItemRate ?? 0)}`,
    unknownProviderRateLabel: `미지정 provider ${formatRateLabel(safe?.unknownProviderRate ?? 0)}`,
    cursorCapabilityRateLabel: `Cursor 계열 capability ${formatRateLabel(safe?.cursorCapabilityRate ?? 0)}`,
    githubCapabilityRateLabel: `GitHub capability ${formatRateLabel(safe?.githubCapabilityRate ?? 0)}`,
    findingRateLabel: `진단 발생 plan ${formatRateLabel(safe?.findingRate ?? 0)}`,
  };
}
