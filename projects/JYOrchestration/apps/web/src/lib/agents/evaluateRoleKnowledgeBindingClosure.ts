/**
 * Stage 5-A aggregate closure package (read-only; Stage 5-B candidate guard only).
 */

import { sortedDefaultKnowledgePackIds } from "@/lib/agents/roleKnowledgeBindingInputHygiene";
import type {
  RoleKnowledgeBindingClosureFinding,
  RoleKnowledgeBindingClosureInput,
  RoleKnowledgeBindingClosureReport,
} from "@/lib/agents/roleKnowledgeBindingClosureTypes";
import {
  appendRoleKnowledgeBindingClosureFindings,
  buildClosureSummary,
  buildRoleKnowledgeBindingClosureBoundaryChecklist,
  buildRoleKnowledgeBindingClosureChecklist,
  buildRoleKnowledgeBindingClosureFingerprint,
  buildSourceReadinessSnapshot,
  parseRoleKnowledgeBindingClosureInput,
  resolveRoleKnowledgeBindingClosureDecision,
  STAGE5_A_CLOSURE_BOUNDARY_REPORT,
  STAGE5_A_CLOSURE_TITLE,
  STAGE5_A_CLOSURE_VERSION,
  sumAgentField,
} from "@/lib/agents/roleKnowledgeBindingClosureSupport";

export {
  buildRoleKnowledgeBindingClosureFingerprint,
  resolveRoleKnowledgeBindingClosureDecision,
} from "@/lib/agents/roleKnowledgeBindingClosureSupport";

export type { RoleKnowledgeBindingClosureDecisionInput } from "@/lib/agents/roleKnowledgeBindingClosureTypes";

/** Read-only Stage 5-A aggregate closure — does not implement Stage 5-B or knowledge pack CRUD. */
export function evaluateRoleKnowledgeBindingClosure(
  input?: RoleKnowledgeBindingClosureInput,
): RoleKnowledgeBindingClosureReport {
  const parsed = parseRoleKnowledgeBindingClosureInput(input);
  const sourceDefaultKnowledgePackIds = sortedDefaultKnowledgePackIds();
  const snapshot = buildSourceReadinessSnapshot({
    agentTypes: parsed.agentTypes,
    availableKnowledgePackIds: parsed.availableKnowledgePackIds,
    allowMissingOptionalBindings: parsed.allowMissingOptionalBindings,
  });

  const totalRequiredBindingCount = sumAgentField(snapshot.agentSummaries, (s) => s.requiredBindingCount);
  const totalSatisfiedRequiredBindingCount = sumAgentField(
    snapshot.agentSummaries,
    (s) => s.satisfiedRequiredBindingCount,
  );
  const allRequiredBindingsSatisfied = totalSatisfiedRequiredBindingCount === totalRequiredBindingCount;

  const decision = resolveRoleKnowledgeBindingClosureDecision({
    hasBlocked: snapshot.hasBlocked,
    hasDefer: snapshot.hasDefer,
    allReady: snapshot.allReady,
    stage5AClosureReviewConfirmed: parsed.stage5AClosureReviewConfirmed,
    stage5ANotKnowledgePackImplementationConfirmed: parsed.stage5ANotKnowledgePackImplementationConfirmed,
    stage5ANoRagConfirmed: parsed.stage5ANoRagConfirmed,
    stage5ANoPromptInjectionConfirmed: parsed.stage5ANoPromptInjectionConfirmed,
    stage5ANoRuntimeDbUiConfirmed: parsed.stage5ANoRuntimeDbUiConfirmed,
  });

  const closureFingerprint = buildRoleKnowledgeBindingClosureFingerprint({
    agentSummaries: snapshot.agentSummaries,
    sourceDefaultKnowledgePackIdCount: sourceDefaultKnowledgePackIds.length,
    stage5AClosureReviewConfirmed: parsed.stage5AClosureReviewConfirmed,
    stage5ANotKnowledgePackImplementationConfirmed: parsed.stage5ANotKnowledgePackImplementationConfirmed,
    stage5ANoRagConfirmed: parsed.stage5ANoRagConfirmed,
    stage5ANoPromptInjectionConfirmed: parsed.stage5ANoPromptInjectionConfirmed,
    stage5ANoRuntimeDbUiConfirmed: parsed.stage5ANoRuntimeDbUiConfirmed,
  });

  const findings: RoleKnowledgeBindingClosureFinding[] = [];
  appendRoleKnowledgeBindingClosureFindings({ findings, decision, snapshot, parsed });

  return {
    mode: "read_only_role_knowledge_binding_closure",
    stage: "stage_5_a_closure",
    decision,
    closureVersion: STAGE5_A_CLOSURE_VERSION,
    closureTitle: STAGE5_A_CLOSURE_TITLE,
    closureSummary: buildClosureSummary(decision),
    closureFingerprint,
    sourceStage: "stage_5_a",
    sourceEvaluator: "evaluateRoleKnowledgeBindingReadiness",
    sourceDefaultKnowledgePackIds,
    sourceDefaultKnowledgePackIdCount: sourceDefaultKnowledgePackIds.length,
    agentSummaries: snapshot.agentSummaries,
    agentCount: snapshot.agentSummaries.length,
    readyAgentCount: snapshot.agentSummaries.filter((s) => s.decision === "knowledge_binding_ready").length,
    deferredAgentCount: snapshot.agentSummaries.filter((s) => s.decision === "defer").length,
    blockedAgentCount: snapshot.agentSummaries.filter((s) => s.decision === "blocked").length,
    totalBindingCount: sumAgentField(snapshot.agentSummaries, (s) => s.bindingCount),
    totalRequiredBindingCount,
    totalSatisfiedRequiredBindingCount,
    totalOptionalBindingCount: sumAgentField(snapshot.agentSummaries, (s) => s.optionalBindingCount),
    totalSatisfiedOptionalBindingCount: sumAgentField(snapshot.agentSummaries, (s) => s.satisfiedOptionalBindingCount),
    allRequiredBindingsSatisfied,
    noUnknownKnowledgePackIds: !snapshot.anyUnknown,
    noBlankKnowledgePackIdsRemoved: !snapshot.anyBlankRemoved,
    noDuplicateKnowledgePackIdsRemoved: !snapshot.anyDuplicateRemoved,
    closureChecklist: buildRoleKnowledgeBindingClosureChecklist({
      snapshot,
      allRequiredBindingsSatisfied,
      parsed,
    }),
    boundaryChecklist: buildRoleKnowledgeBindingClosureBoundaryChecklist(),
    findings,
    ...STAGE5_A_CLOSURE_BOUNDARY_REPORT,
  };
}
