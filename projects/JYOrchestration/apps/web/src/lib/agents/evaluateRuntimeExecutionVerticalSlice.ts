/**
 * Stage 8-A minimal runtime execution vertical slice evaluator (in-memory only).
 */

import { evaluateRuntimeContractBundleClosure } from "@/lib/agents/evaluateRuntimeContractBundleClosure";
import {
  REQUIRED_STAGE8_A_CONFIRMATIONS,
  RUNTIME_EXECUTION_VERTICAL_SLICE_TITLE,
  RUNTIME_EXECUTION_VERTICAL_SLICE_VERSION,
  STAGE8_A_DEFAULT_NOW_ISO,
  STAGE8_A_RECOMMENDED_NEXT_PHASES,
  STAGE8_A_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionVerticalSliceConstants";
import {
  appendRuntimeExecutionAuditEvent,
  buildRuntimeExecutionAuditEvent,
} from "@/lib/agents/runtimeExecutionVerticalSliceAudit";
import { runMockRuntimeExecution } from "@/lib/agents/runtimeExecutionVerticalSliceRunner";
import {
  appendRuntimeExecutionRecord,
  createInitialRuntimeExecutionStore,
  createRuntimeExecutionRecord,
  transitionRuntimeExecutionRecord,
} from "@/lib/agents/runtimeExecutionVerticalSliceStore";
import {
  buildRuntimeExecutionVerticalSliceChecklists,
  buildRuntimeExecutionVerticalSliceFingerprint,
  buildRuntimeExecutionVerticalSliceSummary,
  normalizeRuntimeExecutionRequest,
  parseRuntimeExecutionVerticalSliceInput,
  resolveRuntimeExecutionVerticalSliceDecision,
  validateRuntimeExecutionRequest,
} from "@/lib/agents/runtimeExecutionVerticalSliceSupport";
import type {
  RuntimeExecutionVerticalSliceFinding,
  RuntimeExecutionVerticalSliceInput,
  RuntimeExecutionVerticalSliceReport,
  RuntimeExecutionRecord,
  RuntimeExecutionVerticalSliceStore,
} from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

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

function finding(
  severity: RuntimeExecutionVerticalSliceFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionVerticalSliceFinding {
  return { severity, code, message };
}

function appendRuntimeExecutionVerticalSliceFindings(input: {
  readonly findings: RuntimeExecutionVerticalSliceFinding[];
  readonly decision: RuntimeExecutionVerticalSliceReport["decision"];
  readonly sourceStage7Decision: string;
  readonly requestValid: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly mockRunnerSuccess: boolean;
  readonly actualExecutionRequested: boolean;
}): void {
  const { findings, decision, sourceStage7Decision, requestValid, confirmationsSatisfied, mockRunnerSuccess, actualExecutionRequested } =
    input;

  findings.push(
    finding("info", "stage8_vertical_slice_created", "Stage 8-A runtime execution vertical slice evaluator created"),
  );

  if (sourceStage7Decision !== "stage7_runtime_contract_bundle_closed") {
    findings.push(finding("warning", "stage7_contract_bundle_not_closed", "Stage 7-C contract bundle is not closed"));
    findings.push(finding("warning", "stage8_confirmation_missing", "Stage 8-A defers until Stage 7-C is closed"));
    return;
  }

  findings.push(finding("info", "stage7_contract_bundle_source_copied", "Stage 7-C bundle closure source copied"));

  if (!requestValid) {
    findings.push(finding("blocking", "stage8_request_invalid", "Runtime execution request is invalid"));
    findings.push(finding("blocking", "stage8_vertical_slice_blocked", "Stage 8-A vertical slice is blocked"));
    return;
  }

  if (actualExecutionRequested !== false) {
    findings.push(
      finding("blocking", "stage8_actual_execution_requested_blocked", "Actual execution request is blocked in Stage 8-A"),
    );
    findings.push(finding("blocking", "stage8_vertical_slice_blocked", "Stage 8-A vertical slice is blocked"));
    return;
  }

  if (!confirmationsSatisfied) {
    findings.push(finding("warning", "stage8_confirmation_missing", "Stage 8-A confirmations are incomplete"));
    return;
  }

  if (!mockRunnerSuccess) {
    findings.push(finding("blocking", "stage8_mock_runner_failed", "Mock runner did not complete successfully"));
    findings.push(finding("blocking", "stage8_vertical_slice_blocked", "Stage 8-A vertical slice is blocked"));
    return;
  }

  findings.push(finding("info", "stage8_in_memory_record_created", "In-memory runtime execution record created"));
  findings.push(finding("info", "stage8_mock_runner_executed", "Mock runtime runner executed in memory"));
  findings.push(finding("info", "stage8_status_transition_completed", "Dry-run-like status transition completed"));
  findings.push(finding("info", "stage8_audit_events_created", "Runtime execution audit events created"));
  findings.push(finding("info", "stage8_no_external_side_effect_verified", "No external side effect verified"));
  findings.push(finding("info", "stage8_no_db_write_verified", "No DB write verified"));
  findings.push(finding("info", "stage8_no_cursor_github_call_verified", "No Cursor/GitHub call verified"));
  findings.push(finding("info", "stage8_no_api_route_handler_verified", "No API route handler verified"));

  if (decision === "stage8_minimal_vertical_slice_ready") {
    findings.push(finding("info", "stage8_minimal_vertical_slice_ready", "Stage 8-A minimal vertical slice is ready"));
  }
}

function executeVerticalSliceChain(input: {
  readonly request: ReturnType<typeof normalizeRuntimeExecutionRequest>;
  readonly nowIso: string;
}): {
  readonly initialRecord: RuntimeExecutionRecord;
  readonly finalRecord: RuntimeExecutionRecord;
  readonly store: RuntimeExecutionVerticalSliceStore;
  readonly mockRunnerResult: ReturnType<typeof runMockRuntimeExecution>;
} {
  const { request, nowIso } = input;
  let store = createInitialRuntimeExecutionStore();

  const initialRecord = createRuntimeExecutionRecord({ request, nowIso });
  store = appendRuntimeExecutionRecord(store, initialRecord);
  store = appendRuntimeExecutionAuditEvent(
    store,
    buildRuntimeExecutionAuditEvent({
      executionId: initialRecord.executionId,
      requestId: request.requestId,
      eventType: "runtime_request_created",
      statusAfter: "requested",
      message: "Runtime execution request created in memory.",
      nowIso,
      sequence: 0,
    }),
  );

  const validatedRecord = transitionRuntimeExecutionRecord(initialRecord, "validated", nowIso);
  store = appendRuntimeExecutionRecord(store, validatedRecord);
  store = appendRuntimeExecutionAuditEvent(
    store,
    buildRuntimeExecutionAuditEvent({
      executionId: validatedRecord.executionId,
      requestId: request.requestId,
      eventType: "runtime_request_validated",
      statusBefore: "requested",
      statusAfter: "validated",
      message: "Runtime execution request validated for mock run.",
      nowIso,
      sequence: 1,
    }),
  );

  const mockRunnerResult = runMockRuntimeExecution({ request, record: validatedRecord, nowIso });

  let finalRecord = validatedRecord;
  if (mockRunnerResult.success) {
    const runningRecord = transitionRuntimeExecutionRecord(validatedRecord, "mock_running", nowIso);
    store = appendRuntimeExecutionRecord(store, runningRecord);
    finalRecord = transitionRuntimeExecutionRecord(runningRecord, "mock_completed", nowIso);
    store = appendRuntimeExecutionRecord(store, finalRecord);
  } else {
    finalRecord = transitionRuntimeExecutionRecord(validatedRecord, "mock_failed", nowIso);
    store = appendRuntimeExecutionRecord(store, finalRecord);
  }

  for (const [index, event] of mockRunnerResult.auditEvents.entries()) {
    store = appendRuntimeExecutionAuditEvent(store, {
      ...event,
      auditEventId: `audit-${event.executionId}-${event.eventType}-runner-${index}`,
    });
  }

  return { initialRecord, finalRecord, store, mockRunnerResult };
}

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

  const { initialRecord, finalRecord, store, mockRunnerResult } = executeVerticalSliceChain({
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
