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
import type { OverlayPolicyWarning } from "@/lib/overlay/overlayPolicyWarning";
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

export type OverlayUiTimelineSnapshotVM = Readonly<{
  hasData: boolean;
  conflictCount: number;
  driftCount: number;
  overflowRiskLabel: string;
  overflowRiskTone: OverlayUiBadgeTone;
  requiredContextsCount: number;
  excludeCandidatesCount: number;
}>;

export type OverlayUiViewModel = Readonly<{
  /** 해당 timeline entry에 overlay metadata가 하나라도 있는지. UI empty state 판별용. */
  hasOverlayData: boolean;
  context: OverlayUiContextSectionVM;
  budget: OverlayUiBudgetSectionVM;
  warning: OverlayUiWarningSectionVM;
  assemblyPlan: OverlayUiAssemblyPlanSectionVM;
  pruning: OverlayUiPruningSectionVM;
  snapshot: OverlayUiTimelineSnapshotVM;
}>;

const PLANNING_COMMENT_NON_EMPTY =
  "현재 선택된 컨텍스트는 실제 프롬프트 포함 여부와 별개의 계획 정보입니다.";
const PLANNING_COMMENT_EMPTY = "Overlay 컨텍스트 정보가 기록되지 않았습니다.";

function safeRefRow(ref: OverlaySelectedContextRef): OverlayUiContextRow {
  const typeLabel =
    ref.type === "role"
      ? "역할"
      : overlayUiPlanTypeLabel(ref.type as Parameters<typeof overlayUiPlanTypeLabel>[0]);
  return {
    typeLabel,
    source: String(ref.source ?? "").trim() || "(미지정)",
    reason: String(ref.reason ?? "").trim() || "ㅡ",
    priority: Number.isFinite(ref.priority) ? Math.max(0, Math.floor(ref.priority)) : 999,
  };
}

function buildContextSection(
  metadata: ExtractedOverlayPromptTraceMetadata
): OverlayUiContextSectionVM {
  const selected = metadata.overlaySelectedContextRefs ?? [];
  const prioritized = metadata.overlayPrioritizedContextRefs ?? [];
  const memoryScopes = (metadata.overlayContextAssembly?.usedMemoryRefs ?? [])
    .map((m) => {
      const scope = String(m.scope ?? "").trim();
      const ref = String(m.ref ?? "").trim();
      return ref ? `${scope}:${ref}` : scope;
    })
    .filter(Boolean);
  const knowledgeHints = (metadata.overlayKnowledgeActivationHints ?? []).map(
    (h) => String(h.knowledgePackId ?? "").trim()
  ).filter(Boolean);
  const identityRoleLabel = metadata.overlayIdentity?.roleKey
    ? `${metadata.overlayIdentity.roleKey} · ${metadata.overlayIdentity.perspective ?? ""}`.trim()
    : null;
  const hasData =
    selected.length > 0 || prioritized.length > 0 || memoryScopes.length > 0 || knowledgeHints.length > 0 || !!identityRoleLabel;
  return {
    hasData,
    selected: selected.map(safeRefRow),
    prioritized: prioritized.map(safeRefRow),
    memoryScopes,
    knowledgeHints,
    identityRoleLabel,
    planningComment: hasData ? PLANNING_COMMENT_NON_EMPTY : PLANNING_COMMENT_EMPTY,
  };
}

function buildBudgetSection(
  budget: OverlayContextBudgetMetadata | undefined
): OverlayUiBudgetSectionVM {
  if (!budget) {
    return {
      hasData: false,
      budgetPolicyLabel: overlayUiBudgetPolicyLabel(null),
      overflowRiskLabel: overlayUiOverflowRiskLabel(null),
      overflowRiskTone: overlayUiOverflowRiskTone(null),
      overflowRiskDescription: overlayUiOverflowRiskDescription(null),
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
    };
  }
  return {
    hasData: true,
    budgetPolicyLabel: overlayUiBudgetPolicyLabel(budget.budgetPolicy),
    overflowRiskLabel: overlayUiOverflowRiskLabel(budget.overflowRisk),
    overflowRiskTone: overlayUiOverflowRiskTone(budget.overflowRisk),
    overflowRiskDescription: overlayUiOverflowRiskDescription(budget.overflowRisk),
    estimatedInputTokens: budget.estimatedInputTokens,
    estimatedOutputTokens: budget.estimatedOutputTokens,
  };
}

function conflictToRow(w: OverlayConflictWarning): OverlayUiWarningRow {
  return {
    code: String(w.code ?? "").trim() || "OVERLAY_CONFLICT",
    severityLabel: overlayUiWarningSeverityLabel(
      (w.severity ?? "info") as Parameters<typeof overlayUiWarningSeverityLabel>[0]
    ),
    severityTone: overlayUiWarningSeverityTone(
      (w.severity ?? "info") as Parameters<typeof overlayUiWarningSeverityTone>[0]
    ),
    message: String(w.message ?? "").trim() || "충돌 메시지가 비어 있습니다.",
  };
}

function policyWarningToRow(w: OverlayPolicyWarning): OverlayUiWarningRow {
  return {
    code: String(w.code ?? "").trim() || "OVERLAY_DRIFT",
    severityLabel: overlayUiWarningSeverityLabel(w.severity),
    severityTone: overlayUiWarningSeverityTone(w.severity),
    message: String(w.message ?? "").trim() || "경고 메시지가 비어 있습니다.",
  };
}

function buildWarningSection(
  metadata: ExtractedOverlayPromptTraceMetadata
): OverlayUiWarningSectionVM {
  const conflicts = metadata.overlayConflictWarnings ?? [];
  const drift = metadata.overlayPolicyDriftWarnings ?? [];
  const conflictRows = conflicts.map(conflictToRow);
  const driftRows = drift.map(policyWarningToRow);
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

function buildAssemblyPlanSection(
  plan: readonly OverlayAssemblyPlanItem[] | undefined
): OverlayUiAssemblyPlanSectionVM {
  const items = plan ?? [];
  const byIncludeMode: Record<OverlayAssemblyIncludeMode, number> = {
    required: 0,
    recommended: 0,
    optional: 0,
    excludeCandidate: 0,
  };
  for (const item of items) {
    byIncludeMode[item.includeMode] = (byIncludeMode[item.includeMode] ?? 0) + 1;
  }
  return {
    hasData: items.length > 0,
    rows: items.map(planItemToRow),
    totalCount: items.length,
    byIncludeMode,
  };
}

function pruningRow(c: OverlayPruningCandidate): OverlayUiPruningRow {
  return {
    source: String(c.source ?? "").trim() || "(미지정)",
    reason: String(c.reason ?? "").trim() || "축소 후보",
    estimatedReduction: Number.isFinite(c.estimatedReduction)
      ? Math.max(0, Math.floor(c.estimatedReduction))
      : 0,
  };
}

function buildPruningSection(
  pruning: readonly OverlayPruningCandidate[] | undefined
): OverlayUiPruningSectionVM {
  const items = pruning ?? [];
  return {
    hasData: items.length > 0,
    rows: items.map(pruningRow),
    description: overlayUiPruningSuggestionDescription(items.length),
  };
}

function buildSnapshot(
  metadata: ExtractedOverlayPromptTraceMetadata,
  plan: OverlayUiAssemblyPlanSectionVM,
  budget: OverlayUiBudgetSectionVM
): OverlayUiTimelineSnapshotVM {
  const conflictCount = metadata.overlayConflictWarnings?.length ?? 0;
  const driftCount = metadata.overlayPolicyDriftWarnings?.length ?? 0;
  const requiredContextsCount = plan.byIncludeMode.required;
  const excludeCandidatesCount = plan.byIncludeMode.excludeCandidate;
  return {
    hasData:
      conflictCount > 0 ||
      driftCount > 0 ||
      requiredContextsCount > 0 ||
      excludeCandidatesCount > 0 ||
      budget.hasData,
    conflictCount,
    driftCount,
    overflowRiskLabel: budget.overflowRiskLabel,
    overflowRiskTone: budget.overflowRiskTone,
    requiredContextsCount,
    excludeCandidatesCount,
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
  const snapshot = buildSnapshot(safe, assemblyPlan, budget);
  return {
    hasOverlayData:
      context.hasData ||
      budget.hasData ||
      warning.hasData ||
      assemblyPlan.hasData ||
      pruning.hasData,
    context,
    budget,
    warning,
    assemblyPlan,
    pruning,
    snapshot,
  };
}
