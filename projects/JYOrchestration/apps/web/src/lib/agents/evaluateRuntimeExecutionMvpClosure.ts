/**
 * Stage 9-B integrated runtime runner/closure bundle (read-only).
 */

import type {
  RuntimeExecutionMvpClosureFinding,
  RuntimeExecutionMvpClosureInput,
  RuntimeExecutionMvpClosureReport,
} from "@/lib/agents/runtimeExecutionMvpClosureTypes";
import {
  REQUIRED_STAGE9_B_CONFIRMATIONS,
  RUNTIME_EXECUTION_MVP_CLOSURE_TITLE,
  RUNTIME_EXECUTION_MVP_CLOSURE_VERSION,
  STAGE10_ENTRY_OUT_OF_SCOPE,
  STAGE10_ENTRY_SCOPE,
  STAGE9_B_RECOMMENDED_NEXT_PHASES,
  STAGE9_B_SEPARATED_WORK_ITEMS,
  appendRuntimeExecutionMvpClosureFindings,
  buildRuntimeExecutionMvpClosureChecklists,
  buildRuntimeExecutionMvpClosureFingerprint,
  buildRuntimeExecutionMvpClosureItems,
  buildRuntimeExecutionMvpClosureSummary,
  computeStage10EntryReady,
  evaluateRuntimeExecutionMvpClosureSource,
  parseRuntimeExecutionMvpClosureInput,
  resolveRuntimeExecutionMvpClosureDecision,
  validateRuntimeExecutionMvpClosureItems,
} from "@/lib/agents/runtimeExecutionMvpClosureSupport";

export {
  resolveRuntimeExecutionMvpClosureDecision,
  buildRuntimeExecutionMvpClosureFingerprint,
} from "@/lib/agents/runtimeExecutionMvpClosureSupport";

export { buildRuntimeExecutionMvpClosureItems } from "@/lib/agents/runtimeExecutionMvpClosureItems";
export { validateRuntimeExecutionMvpClosureItems } from "@/lib/agents/runtimeExecutionMvpClosureValidation";

export {
  buildStage9BReadyRuntimeExecutionMvpClosureInput,
  buildStage9BConfirmedRuntimeExecutionMvpClosureInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type { RuntimeExecutionMvpClosureDecisionInput } from "@/lib/agents/runtimeExecutionMvpClosureTypes";

/** Read-only Stage 9-B runtime MVP closure — does not grant external execution permission. */
export function evaluateRuntimeExecutionMvpClosure(
  input: RuntimeExecutionMvpClosureInput = {},
): RuntimeExecutionMvpClosureReport {
  const source = evaluateRuntimeExecutionMvpClosureSource(input);
  const parsed = parseRuntimeExecutionMvpClosureInput(input);
  const closureItems = buildRuntimeExecutionMvpClosureItems(source);
  const validation = validateRuntimeExecutionMvpClosureItems(closureItems);
  const stage10EntryReady = computeStage10EntryReady(closureItems, validation);

  const decision = resolveRuntimeExecutionMvpClosureDecision({
    sourceStage9Decision: source.decision,
    sourceStage9AClosureReady: source.stage9AClosureReady,
    sourceActualApiRouteImplementedInThisStep: source.actualApiRouteImplementedInThisStep,
    sourceInMemoryStoreImplementedInThisStep: source.inMemoryStoreImplementedInThisStep,
    sourceMockRunnerAdapterImplementedInThisStep: source.mockRunnerAdapterImplementedInThisStep,
    sourceActualExternalExecutionAllowedInThisStep: source.actualExternalExecutionAllowedInThisStep,
    sourceActualCursorGithubCallAllowedInThisStep: source.actualCursorGithubCallAllowedInThisStep,
    sourceActualConnectorGatewayCallAllowedInThisStep: source.actualConnectorGatewayCallAllowedInThisStep,
    sourceActualDbWriteAllowedInThisStep: source.actualDbWriteAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.actualSchemaMigrationAllowedInThisStep,
    sourceActualUiImplementationAllowedInThisStep: source.actualUiImplementationAllowedInThisStep,
    validationValid: validation.valid,
    stage10EntryReady,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    stage10RequiresSeparateApproval: true,
    stage10ImplementationAllowedInThisStep: false,
  });

  const { checklist, boundaryChecklist } = buildRuntimeExecutionMvpClosureChecklists({
    sourceStage9Decision: source.decision,
    sourceStage9AClosureReady: source.stage9AClosureReady,
    validationValid: validation.valid,
    stage10EntryReady,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const findings: RuntimeExecutionMvpClosureFinding[] = [];
  appendRuntimeExecutionMvpClosureFindings({
    findings,
    decision,
    source,
    validation,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    stage10EntryReady,
  });

  const closureFingerprint = buildRuntimeExecutionMvpClosureFingerprint({
    sourceStage9Decision: source.decision,
    sourceStage9AClosureReady: source.stage9AClosureReady,
    itemCount: closureItems.length,
    stage10CandidateItemCount: closureItems.filter((item) => item.stage10Candidate).length,
    requiredBeforeStage10ItemCount: closureItems.filter((item) => item.requiredBeforeStage10).length,
    confirmationCount: parsed.confirmationCount,
  });

  return {
    mode: "read_only_runtime_mvp_closure_bundle",
    stage: "stage_9_b_integrated_runtime_runner_closure_bundle",
    decision,
    sourceStage9Decision: source.decision,
    sourceStage9AClosureReady: source.stage9AClosureReady,
    sourceActualApiRouteImplementedInThisStep: source.actualApiRouteImplementedInThisStep,
    sourceInMemoryStoreImplementedInThisStep: source.inMemoryStoreImplementedInThisStep,
    sourceMockRunnerAdapterImplementedInThisStep: source.mockRunnerAdapterImplementedInThisStep,
    sourceActualExternalExecutionAllowedInThisStep: source.actualExternalExecutionAllowedInThisStep,
    sourceActualCursorGithubCallAllowedInThisStep: source.actualCursorGithubCallAllowedInThisStep,
    sourceActualConnectorGatewayCallAllowedInThisStep: source.actualConnectorGatewayCallAllowedInThisStep,
    sourceActualDbWriteAllowedInThisStep: source.actualDbWriteAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.actualSchemaMigrationAllowedInThisStep,
    sourceActualUiImplementationAllowedInThisStep: source.actualUiImplementationAllowedInThisStep,
    closureVersion: RUNTIME_EXECUTION_MVP_CLOSURE_VERSION,
    closureTitle: RUNTIME_EXECUTION_MVP_CLOSURE_TITLE,
    closureSummary: buildRuntimeExecutionMvpClosureSummary(decision),
    closureFingerprint,
    stage10EntryCandidate: "external_execution_adapter_design",
    stage10EntryReady,
    stage10EntryScope: [...STAGE10_ENTRY_SCOPE],
    stage10EntryOutOfScope: [...STAGE10_ENTRY_OUT_OF_SCOPE],
    stage10RequiresSeparateApproval: true,
    stage10ImplementationAllowedInThisStep: false,
    closureItems,
    validation,
    requiredConfirmations: [...REQUIRED_STAGE9_B_CONFIRMATIONS],
    checklist,
    boundaryChecklist,
    findings,
    itemCount: closureItems.length,
    stage10CandidateItemCount: closureItems.filter((item) => item.stage10Candidate).length,
    requiredBeforeStage10ItemCount: closureItems.filter((item) => item.requiredBeforeStage10).length,
    recommendedNextPhases: [...STAGE9_B_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE9_B_SEPARATED_WORK_ITEMS],
  };
}
