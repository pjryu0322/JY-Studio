/**
 * Stage 8-A minimal runtime execution vertical slice evaluator (in-memory only).
 */

import { evaluateRuntimeContractBundleClosure } from "@/lib/agents/evaluateRuntimeContractBundleClosure";
import type {
  RuntimeExecutionVerticalSliceFinding,
  RuntimeExecutionVerticalSliceInput,
  RuntimeExecutionVerticalSliceReport,
} from "@/lib/agents/runtimeExecutionVerticalSliceTypes";
import {
  REQUIRED_STAGE8_A_CONFIRMATIONS,
  RUNTIME_EXECUTION_VERTICAL_SLICE_TITLE,
  RUNTIME_EXECUTION_VERTICAL_SLICE_VERSION,
  STAGE8_A_DEFAULT_NOW_ISO,
  STAGE8_A_RECOMMENDED_NEXT_PHASES,
  STAGE8_A_SEPARATED_WORK_ITEMS,
  appendRuntimeExecutionVerticalSliceFindings,
  buildRuntimeExecutionVerticalSliceChecklists,
  buildRuntimeExecutionVerticalSliceFingerprint,
  buildRuntimeExecutionVerticalSliceSummary,
  executeRuntimeExecutionVerticalSliceChain,
  normalizeRuntimeExecutionRequest,
  parseRuntimeExecutionVerticalSliceInput,
  resolveRuntimeExecutionVerticalSliceDecision,
  validateRuntimeExecutionRequest,
} from "@/lib/agents/runtimeExecutionVerticalSliceSupport";

export {
  normalizeRuntimeExecutionRequest,
  validateRuntimeExecutionRequest,
  resolveRuntimeExecutionVerticalSliceDecision,
  buildRuntimeExecutionVerticalSliceFingerprint,
} from "@/lib/agents/runtimeExecutionVerticalSliceSupport";

export {
  createInitialRuntimeExecutionStore,
  createRuntimeExecutionRecord,
  appendRuntimeExecutionRecord,
  transitionRuntimeExecutionRecord,
} from "@/lib/agents/runtimeExecutionVerticalSliceStore";

export { runMockRuntimeExecution } from "@/lib/agents/runtimeExecutionVerticalSliceRunner";

export {
  buildStage8AReadyVerticalSliceInput,
  buildStage8AConfirmedVerticalSliceInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

/** Stage 8-A in-memory mock runtime execution vertical slice — no external side effects. */
export function evaluateRuntimeExecutionVerticalSlice(
  input: RuntimeExecutionVerticalSliceInput = {},
): RuntimeExecutionVerticalSliceReport {
  const source = evaluateRuntimeContractBundleClosure(input.contractBundleClosure);
  const parsed = parseRuntimeExecutionVerticalSliceInput(input);
  const request = normalizeRuntimeExecutionRequest(input.request);
  const requestValidation = validateRuntimeExecutionRequest(request);
  const actualExecutionRequestedBlocked = input.request?.actualExecutionRequested === true;
  const requestValid = requestValidation.valid && !actualExecutionRequestedBlocked;
  const nowIso = STAGE8_A_DEFAULT_NOW_ISO;

  const { initialRecord, finalRecord, store, mockRunnerResult } = executeRuntimeExecutionVerticalSliceChain({
    request,
    nowIso,
  });

  const decision = resolveRuntimeExecutionVerticalSliceDecision({
    sourceStage7Decision: source.decision,
    sourceStage8EntryReady: source.stage8EntryReady,
    requestValid,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    mockRunnerSuccess: mockRunnerResult.success,
    actualExecutionRequested: actualExecutionRequestedBlocked,
    externalSideEffect: mockRunnerResult.externalSideEffect !== false,
  });

  const { checklist, boundaryChecklist } = buildRuntimeExecutionVerticalSliceChecklists({
    sourceStage8EntryReady: source.stage8EntryReady,
    requestValid,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    mockRunnerResult,
  });

  const findings: RuntimeExecutionVerticalSliceFinding[] = [];
  appendRuntimeExecutionVerticalSliceFindings({
    findings,
    decision,
    sourceStage7Decision: source.decision,
    requestValid,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    mockRunnerSuccess: mockRunnerResult.success,
    actualExecutionRequested: actualExecutionRequestedBlocked,
  });

  const verticalSliceFingerprint = buildRuntimeExecutionVerticalSliceFingerprint({
    sourceStage7Decision: source.decision,
    requestId: request.requestId,
    finalStatus: finalRecord.status,
    auditEventCount: store.auditEvents.length,
    confirmationCount: parsed.confirmationCount,
  });

  return {
    mode: "in_memory_mock_runtime_execution",
    stage: "stage_8_a_minimal_runtime_execution_vertical_slice",
    decision,
    sourceStage7Decision: source.decision,
    sourceStage8EntryReady: source.stage8EntryReady,
    sourceStage8EntryScope: [...source.stage8EntryScope],
    sourceStage8EntryOutOfScope: [...source.stage8EntryOutOfScope],
    verticalSliceVersion: RUNTIME_EXECUTION_VERTICAL_SLICE_VERSION,
    verticalSliceTitle: RUNTIME_EXECUTION_VERTICAL_SLICE_TITLE,
    verticalSliceSummary: buildRuntimeExecutionVerticalSliceSummary(decision),
    verticalSliceFingerprint,
    inMemoryOnly: true,
    mockRunnerOnly: true,
    actualRuntimeExecutionAllowedInThisStep: false,
    actualApiRouteAllowedInThisStep: false,
    actualExecutionRunnerAllowedInThisStep: false,
    actualDryRunRunnerAllowedInThisStep: false,
    actualCursorGithubCallAllowedInThisStep: false,
    actualConnectorGatewayCallAllowedInThisStep: false,
    actualDbWriteAllowedInThisStep: false,
    actualSchemaMigrationAllowedInThisStep: false,
    actualUiAllowedInThisStep: false,
    request,
    initialRecord,
    finalRecord,
    store,
    mockRunnerResult,
    requiredConfirmations: [...REQUIRED_STAGE8_A_CONFIRMATIONS],
    checklist,
    boundaryChecklist,
    findings,
    recommendedNextPhases: [...STAGE8_A_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE8_A_SEPARATED_WORK_ITEMS],
  };
}
