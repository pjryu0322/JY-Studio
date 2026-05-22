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
  buildSkippedRuntimeExecutionVerticalSliceChain,
  executeRuntimeExecutionVerticalSliceChain,
  normalizeRuntimeExecutionRequest,
  parseRuntimeExecutionVerticalSliceInput,
  resolveRuntimeExecutionVerticalSliceDecision,
  validateRuntimeExecutionRequest,
  validateRuntimeExecutionRequestInput,
} from "@/lib/agents/runtimeExecutionVerticalSliceSupport";

export {
  normalizeRuntimeExecutionRequest,
  validateRuntimeExecutionRequest,
  validateRuntimeExecutionRequestInput,
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

function resolveVerticalSliceChainExecution(input: {
  readonly sourceStage7Decision: string;
  readonly requestValid: boolean;
  readonly rawActualExecutionRequested: boolean;
}): { readonly chainExecuted: boolean; readonly chainSkippedReason: string } {
  if (input.sourceStage7Decision !== "stage7_runtime_contract_bundle_closed") {
    return { chainExecuted: false, chainSkippedReason: "stage7_contract_bundle_not_closed" };
  }
  if (input.rawActualExecutionRequested) {
    return { chainExecuted: false, chainSkippedReason: "actual_execution_requested" };
  }
  if (!input.requestValid) {
    return { chainExecuted: false, chainSkippedReason: "request_invalid" };
  }
  return { chainExecuted: true, chainSkippedReason: "" };
}

/** Stage 8-A in-memory mock runtime execution vertical slice — no external side effects. */
export function evaluateRuntimeExecutionVerticalSlice(
  input: RuntimeExecutionVerticalSliceInput = {},
): RuntimeExecutionVerticalSliceReport {
  const source = evaluateRuntimeContractBundleClosure(input.contractBundleClosure);
  const parsed = parseRuntimeExecutionVerticalSliceInput(input);
  const rawActualExecutionRequested = input.request?.actualExecutionRequested === true;
  const actualExecutionRequestBlocked = rawActualExecutionRequested;
  const rawValidation = validateRuntimeExecutionRequestInput(input.request);
  const request = normalizeRuntimeExecutionRequest(input.request);
  const normalizedValidation = validateRuntimeExecutionRequest(request);
  const requestValid =
    rawValidation.valid && normalizedValidation.valid && !actualExecutionRequestBlocked;
  const chainPlan = resolveVerticalSliceChainExecution({
    sourceStage7Decision: source.decision,
    requestValid,
    rawActualExecutionRequested,
  });
  const nowIso = STAGE8_A_DEFAULT_NOW_ISO;

  const chainResult = chainPlan.chainExecuted
    ? executeRuntimeExecutionVerticalSliceChain({ request, nowIso })
    : buildSkippedRuntimeExecutionVerticalSliceChain({
        request,
        reason: chainPlan.chainSkippedReason,
        nowIso,
      });

  const { initialRecord, finalRecord, store, mockRunnerResult } = chainResult;

  const decision = resolveRuntimeExecutionVerticalSliceDecision({
    sourceStage7Decision: source.decision,
    sourceStage8EntryReady: source.stage8EntryReady,
    requestValid,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    mockRunnerSuccess: mockRunnerResult.success,
    actualExecutionRequested: actualExecutionRequestBlocked,
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
    rawValidationValid: rawValidation.valid,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    mockRunnerSuccess: mockRunnerResult.success,
    rawActualExecutionRequested,
    actualExecutionRequestBlocked,
    chainExecuted: chainPlan.chainExecuted,
    chainSkippedReason: chainPlan.chainSkippedReason,
  });

  const verticalSliceFingerprint = buildRuntimeExecutionVerticalSliceFingerprint({
    sourceStage7Decision: source.decision,
    requestId: request.requestId,
    finalStatus: finalRecord.status,
    auditEventCount: store.auditEvents.length,
    confirmationCount: parsed.confirmationCount,
    chainExecuted: chainPlan.chainExecuted,
    chainSkippedReason: chainPlan.chainSkippedReason,
    rawActualExecutionRequested,
    actualExecutionRequestBlocked,
    recordCount: store.records.length,
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
    rawActualExecutionRequested,
    actualExecutionRequestBlocked,
    chainExecuted: chainPlan.chainExecuted,
    chainSkippedReason: chainPlan.chainSkippedReason,
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
