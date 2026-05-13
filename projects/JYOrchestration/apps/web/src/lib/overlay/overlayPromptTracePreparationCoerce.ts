/**
 * Overlay 5단계(Selection / Budget / Conflict / DecisionTrace) optional metadata를
 * unknown raw 입력에서 **한 번에 안전하게 정규화** 한다. extract / coerce 두 경로가
 * 동일한 dispatch를 공유하도록 단일 진실 원으로 묶는다.
 *
 * **read-only**. prompt 본문/라우팅/payload 어느 것도 변경하지 않는다.
 */

import {
  OVERLAY_SELECTED_CONTEXT_REFS_MAX,
  parseOverlaySelectedContextRefsFromUnknown,
  type OverlaySelectedContextRef,
} from "@/lib/overlay/overlayContextSelection";
import {
  parseOverlayContextBudgetMetadataFromUnknown,
  type OverlayContextBudgetMetadata,
} from "@/lib/overlay/overlayContextBudget";
import {
  parseOverlayConflictWarningsFromUnknown,
  type OverlayConflictWarning,
} from "@/lib/overlay/overlayConflictDetection";
import {
  parseOverlayOrchestrationDecisionTraceFromUnknown,
  type OverlayOrchestrationDecisionTrace,
} from "@/lib/overlay/overlayOrchestrationDecisionTrace";
import {
  parseOverlayAssemblyPlanFromUnknown,
  type OverlayAssemblyPlanItem,
} from "@/lib/overlay/overlayContextAssemblyPlan";
import {
  parseOverlayPruningCandidatesFromUnknown,
  type OverlayPruningCandidate,
} from "@/lib/overlay/overlayContextPruning";

export type OverlayPromptTracePreparationMetadata = Readonly<{
  overlaySelectedContextRefs?: readonly OverlaySelectedContextRef[];
  overlayContextBudget?: OverlayContextBudgetMetadata;
  overlayConflictWarnings?: readonly OverlayConflictWarning[];
  overlayOrchestrationDecisionTrace?: OverlayOrchestrationDecisionTrace;
  overlayContextAssemblyPlan?: readonly OverlayAssemblyPlanItem[];
  overlayPruningCandidates?: readonly OverlayPruningCandidate[];
}>;

/**
 * 5단계 optional metadata 4종을 한 번에 정규화한다. 각 필드는 개별 parser의 규칙을 따른다(없으면 omit).
 */
export function coerceOverlayPromptTracePreparationMetadata(
  raw: Record<string, unknown> | null | undefined
): OverlayPromptTracePreparationMetadata {
  if (!raw || typeof raw !== "object") return {};
  const out: {
    overlaySelectedContextRefs?: readonly OverlaySelectedContextRef[];
    overlayContextBudget?: OverlayContextBudgetMetadata;
    overlayConflictWarnings?: readonly OverlayConflictWarning[];
    overlayOrchestrationDecisionTrace?: OverlayOrchestrationDecisionTrace;
    overlayContextAssemblyPlan?: readonly OverlayAssemblyPlanItem[];
    overlayPruningCandidates?: readonly OverlayPruningCandidate[];
  } = {};

  const refs = parseOverlaySelectedContextRefsFromUnknown(raw.overlaySelectedContextRefs).slice(
    0,
    OVERLAY_SELECTED_CONTEXT_REFS_MAX
  );
  if (refs.length) out.overlaySelectedContextRefs = refs;

  const budget = parseOverlayContextBudgetMetadataFromUnknown(raw.overlayContextBudget);
  if (budget) out.overlayContextBudget = budget;

  const conflicts = parseOverlayConflictWarningsFromUnknown(raw.overlayConflictWarnings);
  if (conflicts.length) out.overlayConflictWarnings = conflicts;

  const decision = parseOverlayOrchestrationDecisionTraceFromUnknown(raw.overlayOrchestrationDecisionTrace);
  if (decision) out.overlayOrchestrationDecisionTrace = decision;

  const plan = parseOverlayAssemblyPlanFromUnknown(raw.overlayContextAssemblyPlan);
  if (plan.length) out.overlayContextAssemblyPlan = plan;

  const pruning = parseOverlayPruningCandidatesFromUnknown(raw.overlayPruningCandidates);
  if (pruning.length) out.overlayPruningCandidates = pruning;

  return out;
}
