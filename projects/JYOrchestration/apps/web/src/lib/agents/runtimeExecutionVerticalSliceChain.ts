/**
 * Stage 8-A in-memory vertical slice execution chain (read-only).
 */

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
import type {
  RuntimeExecutionMockRunnerResult,
  RuntimeExecutionRecord,
  RuntimeExecutionRequest,
  RuntimeExecutionVerticalSliceStore,
} from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

export function executeRuntimeExecutionVerticalSliceChain(input: {
  readonly request: RuntimeExecutionRequest;
  readonly nowIso: string;
}): {
  readonly initialRecord: RuntimeExecutionRecord;
  readonly finalRecord: RuntimeExecutionRecord;
  readonly store: RuntimeExecutionVerticalSliceStore;
  readonly mockRunnerResult: RuntimeExecutionMockRunnerResult;
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
