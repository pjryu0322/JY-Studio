/**
 * Stage 8-B integrated runtime control bundle (read-only; no implementation permission).
 */

import type {
  RuntimeControlBundleFinding,
  RuntimeControlBundleInput,
  RuntimeControlBundleReport,
} from "@/lib/agents/runtimeControlBundleTypes";
import {
  REQUIRED_STAGE8_B_CONFIRMATIONS,
  RUNTIME_CONTROL_BUNDLE_TITLE,
  RUNTIME_CONTROL_BUNDLE_VERSION,
  STAGE8_B_RECOMMENDED_NEXT_PHASES,
  STAGE8_B_SEPARATED_WORK_ITEMS,
  STAGE9_ENTRY_OUT_OF_SCOPE,
  STAGE9_ENTRY_SCOPE,
  buildRuntimeControlBundleChecklists,
  buildRuntimeControlBundleFingerprint,
  buildRuntimeControlBundleItems,
  buildRuntimeControlBundleSummary,
  computeStage9EntryReady,
  evaluateRuntimeControlBundleSource,
  parseRuntimeControlBundleInput,
  resolveRuntimeControlBundleDecision,
  validateRuntimeControlBundleItems,
} from "@/lib/agents/runtimeControlBundleSupport";
import { appendRuntimeControlBundleFindings } from "@/lib/agents/runtimeControlBundleFindings";

export {
  resolveRuntimeControlBundleDecision,
  buildRuntimeControlBundleFingerprint,
} from "@/lib/agents/runtimeControlBundleSupport";

export { buildRuntimeControlBundleItems } from "@/lib/agents/runtimeControlBundleItems";
export { validateRuntimeControlBundleItems } from "@/lib/agents/runtimeControlBundleValidation";

export {
  buildStage8BReadyRuntimeControlBundleInput,
  buildStage8BConfirmedRuntimeControlBundleInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type { RuntimeControlBundleDecisionInput } from "@/lib/agents/runtimeControlBundleTypes";

/** Read-only Stage 8-B runtime control bundle — does not grant implementation permission. */
export function evaluateRuntimeControlBundle(
  input: RuntimeControlBundleInput = {},
): RuntimeControlBundleReport {
  const source = evaluateRuntimeControlBundleSource(input);
  const parsed = parseRuntimeControlBundleInput(input);
  const controlItems = buildRuntimeControlBundleItems(source);
  const validation = validateRuntimeControlBundleItems(controlItems);
  const stage9EntryReady = computeStage9EntryReady(controlItems, validation);

  const decision = resolveRuntimeControlBundleDecision({
    sourceStage8Decision: source.decision,
    sourceChainExecuted: source.chainExecuted,
    sourceFinalStatus: source.finalRecord.status,
    sourceInMemoryOnly: source.inMemoryOnly,
    sourceMockRunnerOnly: source.mockRunnerOnly,
    sourceActualRuntimeExecutionAllowedInThisStep: source.actualRuntimeExecutionAllowedInThisStep,
    sourceActualApiRouteAllowedInThisStep: source.actualApiRouteAllowedInThisStep,
    sourceActualExecutionRunnerAllowedInThisStep: source.actualExecutionRunnerAllowedInThisStep,
    sourceActualDryRunRunnerAllowedInThisStep: source.actualDryRunRunnerAllowedInThisStep,
    sourceActualCursorGithubCallAllowedInThisStep: source.actualCursorGithubCallAllowedInThisStep,
    sourceActualConnectorGatewayCallAllowedInThisStep: source.actualConnectorGatewayCallAllowedInThisStep,
    sourceActualDbWriteAllowedInThisStep: source.actualDbWriteAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.actualSchemaMigrationAllowedInThisStep,
    sourceActualUiAllowedInThisStep: source.actualUiAllowedInThisStep,
    validationValid: validation.valid,
    stage9EntryReady,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    stage9RequiresSeparateApproval: true,
    stage9ImplementationAllowedInThisStep: false,
  });

  const { checklist, boundaryChecklist } = buildRuntimeControlBundleChecklists({
    sourceStage8Decision: source.decision,
    sourceChainExecuted: source.chainExecuted,
    validationValid: validation.valid,
    stage9EntryReady,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const findings: RuntimeControlBundleFinding[] = [];
  appendRuntimeControlBundleFindings({
    findings,
    decision,
    source,
    validation,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    stage9EntryReady,
  });

  const controlBundleFingerprint = buildRuntimeControlBundleFingerprint({
    sourceStage8Decision: source.decision,
    sourceFinalStatus: source.finalRecord.status,
    itemCount: controlItems.length,
    stage9CandidateItemCount: controlItems.filter((item) => item.stage9Candidate).length,
    requiredBeforeStage9ItemCount: controlItems.filter((item) => item.requiredBeforeStage9).length,
    confirmationCount: parsed.confirmationCount,
  });

  return {
    mode: "read_only_runtime_control_bundle",
    stage: "stage_8_b_integrated_runtime_control_bundle",
    decision,
    sourceStage8Decision: source.decision,
    sourceChainExecuted: source.chainExecuted,
    sourceFinalStatus: source.finalRecord.status,
    sourceInMemoryOnly: source.inMemoryOnly,
    sourceMockRunnerOnly: source.mockRunnerOnly,
    sourceActualRuntimeExecutionAllowedInThisStep: source.actualRuntimeExecutionAllowedInThisStep,
    sourceActualApiRouteAllowedInThisStep: source.actualApiRouteAllowedInThisStep,
    sourceActualExecutionRunnerAllowedInThisStep: source.actualExecutionRunnerAllowedInThisStep,
    sourceActualDryRunRunnerAllowedInThisStep: source.actualDryRunRunnerAllowedInThisStep,
    sourceActualCursorGithubCallAllowedInThisStep: source.actualCursorGithubCallAllowedInThisStep,
    sourceActualConnectorGatewayCallAllowedInThisStep: source.actualConnectorGatewayCallAllowedInThisStep,
    sourceActualDbWriteAllowedInThisStep: source.actualDbWriteAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.actualSchemaMigrationAllowedInThisStep,
    sourceActualUiAllowedInThisStep: source.actualUiAllowedInThisStep,
    controlBundleVersion: RUNTIME_CONTROL_BUNDLE_VERSION,
    controlBundleTitle: RUNTIME_CONTROL_BUNDLE_TITLE,
    controlBundleSummary: buildRuntimeControlBundleSummary(decision),
    controlBundleFingerprint,
    controlBundleOnly: true,
    stage9EntryCandidate: "runtime_execution_orchestration_mvp",
    stage9EntryReady,
    stage9EntryScope: [...STAGE9_ENTRY_SCOPE],
    stage9EntryOutOfScope: [...STAGE9_ENTRY_OUT_OF_SCOPE],
    stage9RequiresSeparateApproval: true,
    stage9ImplementationAllowedInThisStep: false,
    actualApiRouteImplementedInThisStep: false,
    actualRunnerImplementedInThisStep: false,
    actualDryRunRunnerImplementedInThisStep: false,
    actualCursorGithubWireImplementedInThisStep: false,
    actualDbWriteImplementedInThisStep: false,
    actualSchemaMigrationImplementedInThisStep: false,
    actualUiImplementedInThisStep: false,
    requiredConfirmations: [...REQUIRED_STAGE8_B_CONFIRMATIONS],
    controlItems,
    validation,
    checklist,
    boundaryChecklist,
    findings,
    itemCount: controlItems.length,
    stage9CandidateItemCount: controlItems.filter((item) => item.stage9Candidate).length,
    requiredBeforeStage9ItemCount: controlItems.filter((item) => item.requiredBeforeStage9).length,
    recommendedNextPhases: [...STAGE8_B_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE8_B_SEPARATED_WORK_ITEMS],
  };
}
