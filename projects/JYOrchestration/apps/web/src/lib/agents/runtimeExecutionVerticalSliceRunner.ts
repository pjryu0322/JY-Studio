/**
 * Stage 8-A mock runtime runner (no external side effects).
 */

import { buildRuntimeExecutionAuditEvent } from "@/lib/agents/runtimeExecutionVerticalSliceAudit";
import { STAGE8_A_DEFAULT_NOW_ISO } from "@/lib/agents/runtimeExecutionVerticalSliceConstants";
import { transitionRuntimeExecutionRecord } from "@/lib/agents/runtimeExecutionVerticalSliceStore";
import type {
  RuntimeExecutionMockRunnerResult,
  RuntimeExecutionRecord,
  RuntimeExecutionRequest,
} from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

export function runMockRuntimeExecution(input: {
  readonly request: RuntimeExecutionRequest;
  readonly record: RuntimeExecutionRecord;
  readonly nowIso?: string;
}): RuntimeExecutionMockRunnerResult {
  const nowIso = input.nowIso ?? STAGE8_A_DEFAULT_NOW_ISO;
  const { request, record } = input;

  const fail = (message: string): RuntimeExecutionMockRunnerResult => {
    const failedRecord = transitionRuntimeExecutionRecord(record, "mock_failed", nowIso);
    const auditEvents = [
      buildRuntimeExecutionAuditEvent({
        executionId: failedRecord.executionId,
        requestId: request.requestId,
        eventType: "mock_runner_failed",
        statusBefore: record.status,
        statusAfter: "mock_failed",
        message,
        nowIso,
        sequence: 0,
      }),
    ];
    return {
      executionId: failedRecord.executionId,
      requestId: request.requestId,
      status: "mock_failed",
      success: false,
      message,
      actualRunnerInvoked: false,
      externalSideEffect: false,
      auditEvents,
    };
  };

  if (request.approvedForMockRun !== true) {
    return fail("Mock run requires approvedForMockRun=true.");
  }
  if (request.actualExecutionRequested !== false) {
    return fail("Actual execution is not allowed in Stage 8-A.");
  }
  if (request.commandPreview.trim().length === 0) {
    return fail("commandPreview must not be empty.");
  }

  const runningRecord = transitionRuntimeExecutionRecord(record, "mock_running", nowIso);
  const completedRecord = transitionRuntimeExecutionRecord(runningRecord, "mock_completed", nowIso);

  const auditEvents = [
    buildRuntimeExecutionAuditEvent({
      executionId: completedRecord.executionId,
      requestId: request.requestId,
      eventType: "mock_runner_started",
      statusBefore: record.status,
      statusAfter: "mock_running",
      message: "Mock runner started in memory.",
      nowIso,
      sequence: 0,
    }),
    buildRuntimeExecutionAuditEvent({
      executionId: completedRecord.executionId,
      requestId: request.requestId,
      eventType: "mock_runner_completed",
      statusBefore: "mock_running",
      statusAfter: "mock_completed",
      message: "Mock runner completed in memory.",
      nowIso,
      sequence: 1,
    }),
    buildRuntimeExecutionAuditEvent({
      executionId: completedRecord.executionId,
      requestId: request.requestId,
      eventType: "runtime_boundary_checked",
      statusAfter: "mock_completed",
      message: "No external side effects; in-memory boundary verified.",
      nowIso,
      sequence: 2,
    }),
  ];

  return {
    executionId: completedRecord.executionId,
    requestId: request.requestId,
    status: "mock_completed",
    success: true,
    message: "Mock runtime execution completed in memory.",
    actualRunnerInvoked: false,
    externalSideEffect: false,
    auditEvents,
  };
}
