/**
 * Overlay Observability UI — `ExtractedOverlayPromptTraceMetadata`(또는 그에 준하는 raw)
 * 를 **사용자 표현용 ViewModel**로 변환한다.
 *
 * **순수 함수**. runtime payload·라우팅·prompt 본문 어디에도 영향 없음.
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { OverlayAssemblyPlanItem, OverlayAssemblyIncludeMode } from "@/lib/overlay/overlayContextAssemblyPlan";
import type { OverlaySelectedContextRef } from "@/lib/overlay/overlayContextSelection";
import type { OverlayContextBudgetMetadata } from "@/lib/overlay/overlayContextBudget";
import type { OverlayConflictWarning } from "@/lib/overlay/overlayConflictDetection";
import type { OverlayPolicyWarning, OverlayPolicyWarningSeverity } from "@/lib/overlay/overlayPolicyWarning";
import type { OverlayPruningCandidate } from "@/lib/overlay/overlayContextPruning";
import {
  overlayUiBudgetPolicyLabel,
  overlayUiIncludeModeLabel,
  overlayUiIncludeModeTone,
  overlayUiOverflowRiskLabel,
  overlayUiOverflowRiskTone,
  overlayUiPlanTypeLabel,
  overlayUiWarningSeverityLabel,
  overlayUiWarningSeverityTone,
  type OverlayUiBadgeTone,
} from "@/lib/overlay-ui/overlayUiLabel";
import {
  overlayUiConflictWarningDescription,
  overlayUiIncludeModeDescription,
  overlayUiOverflowRiskDescription,
  overlayUiPlanTypeDescription,
  overlayUiPolicyDriftDescription,
  overlayUiPruningSuggestionDescription,
} from "@/lib/overlay-ui/overlayUiDescription";

export type OverlayUiContextRow = Readonly<{
  typeLabel: string;
  source: string;
  reason: string;
  priority: number;
}>;

export type OverlayUiContextSectionVM = Readonly<{
  hasData: boolean;
  selected: readonly OverlayUiContextRow[];
  prioritized: readonly OverlayUiContextRow[];
  memoryScopes: readonly string[];
  knowledgeHints: readonly string[];
  identityRoleLabel: string | null;
  /** 핵심: planning metadata임을 명시하는 짧은 코멘트. */
  planningComment: string;
}>;

export type OverlayUiBudgetSectionVM = Readonly<{
  hasData: boolean;
  budgetPolicyLabel: string;
  overflowRiskLabel: string;
  overflowRiskTone: OverlayUiBadgeTone;
  overflowRiskDescription: string;
  estimatedInputTokens: number | null;
  estimatedOutputTokens: number | null;
}>;

export type OverlayUiWarningRow = Readonly<{
  code: string;
  severityLabel: string;
  severityTone: OverlayUiBadgeTone;
  message: string;
}>;

export type OverlayUiWarningSectionVM = Readonly<{
  hasData: boolean;
  conflictRows: readonly OverlayUiWarningRow[];
  driftRows: readonly OverlayUiWarningRow[];
  conflictDescription: string;
  driftDescription: string;
}>;

export type OverlayUiAssemblyPlanRow = Readonly<{
  typeLabel: string;
  typeDescription: string;
  source: string;
  includeReason: string;
  estimatedCost: number;
  includeModeLabel: string;
  includeModeTone: OverlayUiBadgeTone;
  includeModeDescription: string;
  pruningCandidate: boolean;
}>;

export type OverlayUiAssemblyPlanSectionVM = Readonly<{
  hasData: boolean;
  rows: readonly OverlayUiAssemblyPlanRow[];
  totalCount: number;
  byIncludeMode: Readonly<Record<OverlayAssemblyIncludeMode, number>>;
}>;

export type OverlayUiPruningRow = Readonly<{
  source: string;
  reason: string;
  estimatedReduction: number;
}>;

export type OverlayUiPruningSectionVM = Readonly<{
  hasData: boolean;
  rows: readonly OverlayUiPruningRow[];
  description: string;
}>;

/**
 * Overlay 탭 상단 "AI 판단 요약" 헤더 ViewModel.
 *
 * 운영자가 탭을 열자마자 한눈에 상태를 파악할 수 있도록 핵심 지표를 모은 read-only 요약이다.
 * **모든 값은 사용자 표현으로 변환**된 상태(예: 낮음/중간/높음). 내부 enum/code는 노출하지 않는다.
 *
 * 과거 단계의 `OverlayUiTimelineSnapshotVM`(별도의 상단 strip용)을 이 viewmodel로 통합했다.
 * 충돌/정책 분리 카운트는 `conflictCount`/`driftCount`로 유지하며 합계가 `warningCount`.
 */
export type OverlayUiSummaryHeaderVM = Readonly<{
  /** overlay metadata가 존재하는지(empty timeline 구분). */
  hasData: boolean;
  /** "AI 설계자 / planner / unknown" 같은 사용자 친화 역할 라벨. 없으면 null. */
  roleLabel: string | null;
  selectedContextCount: number;
  prioritizedContextCount: number;
  /** 충돌 가능성 경고 수. */
  conflictCount: number;
  /** 정책 기준 차이 경고 수. */
  driftCount: number;
  /** 통합 경고 수 = conflictCount + driftCount. */
  warningCount: number;
  pruningCandidateCount: number;
  /** 사용자 표현(낮음/중간/높음/ㅡ). */
  overflowRiskLabel: string;
  overflowRiskTone: OverlayUiBadgeTone;
  /** 조립 계획 includeMode 카운트(핵심/추천/선택/축소 후보). */
  assemblyIncludeModeCounts: Readonly<Record<OverlayAssemblyIncludeMode, number>>;
}>;

/**
 * 섹션별 기본 펼침/접힘 정책. SummaryCard가 각 section 컴포넌트에 prop으로 전달.
 *
 * 정책 산출은 adapter(단일 출처)에서 수행하여 UI 컴포넌트의 분기 분산을 막는다.
 * - context/budget: 항상 펼침
 * - warning/pruning: 데이터가 있을 때만 펼침
 * - assemblyPlan: 항상 접힘(모바일 과밀 방지)
 */
export type OverlayUiSectionDefaultsVM = Readonly<{
  /** Harness Phase H8.5 — Operator runtime strip. */
  operatorRuntimeSummary: boolean;
  /** Harness Phase H9.5 — Operator resource·overload strip. */
  operatorResourceSummary: boolean;
  context: boolean;
  budget: boolean;
  warning: boolean;
  assemblyPlan: boolean;
  pruning: boolean;
  /** Harness Phase H1 preview 섹션 펼침 정책(데이터 있을 때만 펼침). */
  harnessPromptPreview: boolean;
  /** Harness Phase H3 — Knowledge Activation 섹션 펼침 정책(데이터 있을 때만 펼침). */
  knowledgeActivation: boolean;
  /** Harness Phase H4 Preparation — Memory Runtime 섹션 펼침 정책(데이터 있을 때만 펼침). */
  memoryRuntime: boolean;
  /** Harness Phase H5 Preparation — Execution Routing 섹션 펼침 정책(데이터 있을 때만 펼침). */
  executionRouting: boolean;
  /** Harness Phase H6 Preparation — Review/Security 섹션 펼침 정책(데이터 있을 때만 펼침). */
  reviewSecurity: boolean;
  /** Harness Phase H6.5 — Review/Security Issue Plan 섹션 펼침 정책(데이터 있을 때만 펼침). */
  reviewSecurityIssue: boolean;
  /** Harness Phase H6.5 — Remediation Loop Plan 섹션 펼침 정책(데이터 있을 때만 펼침). */
  remediationLoop: boolean;
  /** Harness Phase H8 — Maturity baseline(진단 요약; 기본 접힘). */
  harnessMaturity: boolean;
  /** Harness Phase H9 — Resource orchestration planning(기본 펼침). */
  resourceOrchestration: boolean;
  /** Harness Phase H10 — Controlled runtime trial preparation(기본 접힘). */
  runtimeTrial: boolean;
  /** Harness Phase H10.5 — Runtime governance planning(기본 접힘). */
  runtimeGovernance: boolean;
  /** Harness Phase H11 — Runtime enforcement candidate(기본 접힘). */
  runtimeEnforcementCandidate: boolean;
  /** Harness Phase H11.5 — Controlled enforcement governance(기본 접힘). */
  controlledEnforcementGovernance: boolean;
  /** Harness Phase H12 — Runtime stability planning(기본 접힘; 포화 시 SummaryCard에서 펼침). */
  runtimeStability: boolean;
}>;

export type OverlayUiViewModel = Readonly<{
  /** 해당 timeline entry에 overlay metadata가 하나라도 있는지. UI empty state 판별용. */
  hasOverlayData: boolean;
  /** 탭 상단 "AI 판단 요약" 헤더. */
  summary: OverlayUiSummaryHeaderVM;
  /** 섹션별 기본 펼침/접힘 정책. */
  sectionDefaults: OverlayUiSectionDefaultsVM;
  context: OverlayUiContextSectionVM;
  budget: OverlayUiBudgetSectionVM;
  warning: OverlayUiWarningSectionVM;
  assemblyPlan: OverlayUiAssemblyPlanSectionVM;
  pruning: OverlayUiPruningSectionVM;
}>;

const MISSING_SOURCE_LABEL = "(미지정)";
const MISSING_REASON_LABEL = "ㅡ";
const ROLE_TYPE_LABEL = "역할";
const DEFAULT_PRIORITY = 999;
const PLANNING_COMMENT_NON_EMPTY =
  "현재 선택된 컨텍스트는 실제 프롬프트 포함 여부와 별개의 계획 정보입니다.";
const PLANNING_COMMENT_EMPTY = "Overlay 컨텍스트 정보가 기록되지 않았습니다.";
const EMPTY_INCLUDE_MODE_COUNTS: Readonly<Record<OverlayAssemblyIncludeMode, number>> = {
  required: 0,
  recommended: 0,
  optional: 0,
  excludeCandidate: 0,
};

/** `String(value ?? "").trim()`이 비면 fallback을 돌려준다. */
function trimOr(value: unknown, fallback: string): string {
  const s = String(value ?? "").trim();
  return s.length ? s : fallback;
}

/** 음수·NaN·Infinity는 fallback으로, 그 외에는 0 이상 정수로 정규화. */
function coerceNonNegInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

function planTypeLabel(type: OverlaySelectedContextRef["type"]): string {
  // OverlaySelectedContextRefType의 "role"은 plan type에 없으므로 별도 라벨 사용.
  return type === "role" ? ROLE_TYPE_LABEL : overlayUiPlanTypeLabel(type);
}

function refToContextRow(ref: OverlaySelectedContextRef): OverlayUiContextRow {
  return {
    typeLabel: planTypeLabel(ref.type),
    source: trimOr(ref.source, MISSING_SOURCE_LABEL),
    reason: trimOr(ref.reason, MISSING_REASON_LABEL),
    priority: coerceNonNegInt(ref.priority, DEFAULT_PRIORITY),
  };
}

function memoryRefLabel(ref: { scope?: unknown; ref?: unknown }): string {
  const scope = String(ref.scope ?? "").trim();
  const r = String(ref.ref ?? "").trim();
  return r ? `${scope}:${r}` : scope;
}

function identityRoleLabel(
  identity: ExtractedOverlayPromptTraceMetadata["overlayIdentity"]
): string | null {
  if (!identity?.roleKey) return null;
  const perspective = String(identity.perspective ?? "").trim();
  return perspective ? `${identity.roleKey} · ${perspective}` : identity.roleKey;
}

function buildContextSection(
  metadata: ExtractedOverlayPromptTraceMetadata
): OverlayUiContextSectionVM {
  const selectedRefs = metadata.overlaySelectedContextRefs ?? [];
  const prioritizedRefs = metadata.overlayPrioritizedContextRefs ?? [];
  const memoryScopes = (metadata.overlayContextAssembly?.usedMemoryRefs ?? [])
    .map(memoryRefLabel)
    .filter(Boolean);
  const knowledgeHints = (metadata.overlayKnowledgeActivationHints ?? [])
    .map((h) => String(h.knowledgePackId ?? "").trim())
    .filter(Boolean);
  const role = identityRoleLabel(metadata.overlayIdentity);
  const hasData =
    selectedRefs.length > 0 ||
    prioritizedRefs.length > 0 ||
    memoryScopes.length > 0 ||
    knowledgeHints.length > 0 ||
    !!role;
  return {
    hasData,
    selected: selectedRefs.map(refToContextRow),
    prioritized: prioritizedRefs.map(refToContextRow),
    memoryScopes,
    knowledgeHints,
    identityRoleLabel: role,
    planningComment: hasData ? PLANNING_COMMENT_NON_EMPTY : PLANNING_COMMENT_EMPTY,
  };
}

function buildBudgetSection(
  budget: OverlayContextBudgetMetadata | undefined
): OverlayUiBudgetSectionVM {
  const risk = budget?.overflowRisk ?? null;
  return {
    hasData: !!budget,
    budgetPolicyLabel: overlayUiBudgetPolicyLabel(budget?.budgetPolicy ?? null),
    overflowRiskLabel: overlayUiOverflowRiskLabel(risk),
    overflowRiskTone: overlayUiOverflowRiskTone(risk),
    overflowRiskDescription: overlayUiOverflowRiskDescription(risk),
    estimatedInputTokens: budget?.estimatedInputTokens ?? null,
    estimatedOutputTokens: budget?.estimatedOutputTokens ?? null,
  };
}

type WarningRowSource = OverlayConflictWarning | OverlayPolicyWarning;

function toWarningRow(
  warning: WarningRowSource,
  fallbackCode: string,
  fallbackMessage: string
): OverlayUiWarningRow {
  const severity = (warning.severity ?? "info") as OverlayPolicyWarningSeverity;
  return {
    code: trimOr(warning.code, fallbackCode),
    severityLabel: overlayUiWarningSeverityLabel(severity),
    severityTone: overlayUiWarningSeverityTone(severity),
    message: trimOr(warning.message, fallbackMessage),
  };
}

function buildWarningSection(
  metadata: ExtractedOverlayPromptTraceMetadata
): OverlayUiWarningSectionVM {
  const conflictRows = (metadata.overlayConflictWarnings ?? []).map((w) =>
    toWarningRow(w, "OVERLAY_CONFLICT", "충돌 메시지가 비어 있습니다.")
  );
  const driftRows = (metadata.overlayPolicyDriftWarnings ?? []).map((w) =>
    toWarningRow(w, "OVERLAY_DRIFT", "경고 메시지가 비어 있습니다.")
  );
  return {
    hasData: conflictRows.length > 0 || driftRows.length > 0,
    conflictRows,
    driftRows,
    conflictDescription: overlayUiConflictWarningDescription(conflictRows.length),
    driftDescription: overlayUiPolicyDriftDescription(driftRows.length),
  };
}

function planItemToRow(item: OverlayAssemblyPlanItem): OverlayUiAssemblyPlanRow {
  return {
    typeLabel: overlayUiPlanTypeLabel(item.type),
    typeDescription: overlayUiPlanTypeDescription(item.type),
    source: item.source,
    includeReason: item.includeReason,
    estimatedCost: item.estimatedCost,
    includeModeLabel: overlayUiIncludeModeLabel(item.includeMode),
    includeModeTone: overlayUiIncludeModeTone(item.includeMode),
    includeModeDescription: overlayUiIncludeModeDescription(item.includeMode),
    pruningCandidate: item.pruningCandidate,
  };
}

function aggregateByIncludeMode(
  items: readonly OverlayAssemblyPlanItem[]
): Readonly<Record<OverlayAssemblyIncludeMode, number>> {
  const acc: Record<OverlayAssemblyIncludeMode, number> = { ...EMPTY_INCLUDE_MODE_COUNTS };
  for (const item of items) acc[item.includeMode] += 1;
  return acc;
}

function buildAssemblyPlanSection(
  plan: readonly OverlayAssemblyPlanItem[] | undefined
): OverlayUiAssemblyPlanSectionVM {
  const items = plan ?? [];
  return {
    hasData: items.length > 0,
    rows: items.map(planItemToRow),
    totalCount: items.length,
    byIncludeMode: aggregateByIncludeMode(items),
  };
}

function candidateToRow(c: OverlayPruningCandidate): OverlayUiPruningRow {
  return {
    source: trimOr(c.source, MISSING_SOURCE_LABEL),
    reason: trimOr(c.reason, "축소 후보"),
    estimatedReduction: coerceNonNegInt(c.estimatedReduction, 0),
  };
}

function buildPruningSection(
  pruning: readonly OverlayPruningCandidate[] | undefined
): OverlayUiPruningSectionVM {
  const items = pruning ?? [];
  return {
    hasData: items.length > 0,
    rows: items.map(candidateToRow),
    description: overlayUiPruningSuggestionDescription(items.length),
  };
}

function buildSummaryHeader(
  context: OverlayUiContextSectionVM,
  budget: OverlayUiBudgetSectionVM,
  warning: OverlayUiWarningSectionVM,
  assemblyPlan: OverlayUiAssemblyPlanSectionVM,
  pruning: OverlayUiPruningSectionVM,
  hasOverlayData: boolean
): OverlayUiSummaryHeaderVM {
  const conflictCount = warning.conflictRows.length;
  const driftCount = warning.driftRows.length;
  return {
    hasData: hasOverlayData,
    roleLabel: context.identityRoleLabel,
    selectedContextCount: context.selected.length,
    prioritizedContextCount: context.prioritized.length,
    conflictCount,
    driftCount,
    warningCount: conflictCount + driftCount,
    pruningCandidateCount: pruning.rows.length,
    overflowRiskLabel: budget.overflowRiskLabel,
    overflowRiskTone: budget.overflowRiskTone,
    assemblyIncludeModeCounts: assemblyPlan.byIncludeMode,
  };
}

function buildSectionDefaults(
  warning: OverlayUiWarningSectionVM,
  pruning: OverlayUiPruningSectionVM,
  hasHarnessPreview: boolean,
  hasKnowledgeActivation: boolean,
  hasMemoryRuntime: boolean,
  hasExecutionRouting: boolean,
  hasReviewSecurity: boolean,
  hasReviewSecurityIssue: boolean,
  hasRemediationLoop: boolean
): OverlayUiSectionDefaultsVM {
  return {
    operatorRuntimeSummary: true,
    operatorResourceSummary: true,
    context: true,
    budget: true,
    warning: warning.hasData,
    assemblyPlan: false,
    pruning: pruning.hasData,
    harnessPromptPreview: hasHarnessPreview,
    knowledgeActivation: hasKnowledgeActivation,
    memoryRuntime: hasMemoryRuntime,
    executionRouting: hasExecutionRouting,
    reviewSecurity: hasReviewSecurity,
    reviewSecurityIssue: hasReviewSecurityIssue,
    remediationLoop: hasRemediationLoop,
    harnessMaturity: false,
    resourceOrchestration: true,
    runtimeTrial: false,
    runtimeGovernance: false,
    runtimeEnforcementCandidate: false,
    controlledEnforcementGovernance: false,
    runtimeStability: false,
  };
}

export function buildOverlayUiViewModel(
  metadata: ExtractedOverlayPromptTraceMetadata | null | undefined
): OverlayUiViewModel {
  const safe = metadata ?? {};
  const context = buildContextSection(safe);
  const budget = buildBudgetSection(safe.overlayContextBudget);
  const warning = buildWarningSection(safe);
  const assemblyPlan = buildAssemblyPlanSection(safe.overlayContextAssemblyPlan);
  const pruning = buildPruningSection(safe.overlayPruningCandidates);
  const hasOverlayData =
    context.hasData ||
    budget.hasData ||
    warning.hasData ||
    assemblyPlan.hasData ||
    pruning.hasData;
  const hasHarnessPreview =
    !!safe.harnessPromptAssemblyPreview && safe.harnessPromptAssemblyPreview.sections.length > 0;
  const hasKnowledgeActivation =
    !!safe.knowledgeActivationPlan &&
    ((safe.knowledgeActivationPlan.items?.length ?? 0) > 0 ||
      (safe.knowledgeActivationPlan.findings?.length ?? 0) > 0);
  const hasMemoryRuntime =
    !!safe.memoryRuntimePlan &&
    ((safe.memoryRuntimePlan.references?.length ?? 0) > 0 ||
      (safe.memoryRuntimePlan.findings?.length ?? 0) > 0);
  const hasExecutionRouting =
    !!safe.executionRoutingPlan &&
    ((safe.executionRoutingPlan.items?.length ?? 0) > 0 ||
      (safe.executionRoutingPlan.findings?.length ?? 0) > 0);
  const hasReviewSecurity =
    !!safe.reviewSecurityHarnessPlan &&
    ((safe.reviewSecurityHarnessPlan.checklist?.length ?? 0) > 0 ||
      (safe.reviewSecurityHarnessPlan.findings?.length ?? 0) > 0);
  const hasReviewSecurityIssue =
    !!safe.reviewSecurityIssuePlanningReport &&
    ((safe.reviewSecurityIssuePlanningReport.issues?.length ?? 0) > 0 ||
      (safe.reviewSecurityIssuePlanningReport.findings?.length ?? 0) > 0);
  const hasRemediationLoop =
    !!safe.remediationLoopPlan &&
    ((safe.remediationLoopPlan.steps?.length ?? 0) > 0 ||
      (safe.remediationLoopPlan.findings?.length ?? 0) > 0);
  return {
    hasOverlayData,
    summary: buildSummaryHeader(context, budget, warning, assemblyPlan, pruning, hasOverlayData),
    sectionDefaults: buildSectionDefaults(
      warning,
      pruning,
      hasHarnessPreview,
      hasKnowledgeActivation,
      hasMemoryRuntime,
      hasExecutionRouting,
      hasReviewSecurity,
      hasReviewSecurityIssue,
      hasRemediationLoop
    ),
    context,
    budget,
    warning,
    assemblyPlan,
    pruning,
  };
}
