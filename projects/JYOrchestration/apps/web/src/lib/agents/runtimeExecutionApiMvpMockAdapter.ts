/**
 * Stage 9-A mock runner adapter (Stage 8-A mock runner only).
 */

import { buildRuntimeExecutionAuditEvent } from "@/lib/agents/runtimeExecutionVerticalSliceAudit";
import { runMockRuntimeExecution } from "@/lib/agents/runtimeExecutionVerticalSliceRunner";
import {
  buildRuntimeExecutionApiErrorResponse,
  buildRuntimeExecutionApiOkResponse,
} from "@/lib/agents/runtimeExecutionApiMvpResponse";
import type { RuntimeExecutionApiMvpStore } from "@/lib/agents/runtimeExecutionApiMvpStore";
import { transitionRuntimeExecutionRecord } from "@/lib/agents/runtimeExecutionVerticalSliceStore";
import type {
  RuntimeExecutionApiMvpMockRunResult,
  RuntimeExecutionApiResponse,
} from "@/lib/agents/runtimeExecutionApiMvpTypes";

export function runRuntimeExecutionMockAdapter(input: {
  readonly store: RuntimeExecutionApiMvpStore;
  readonly executionId: string;
  readonly nowIso: string;
}): RuntimeExecutionApiResponse<RuntimeExecutionApiMvpMockRunResult> {
  const id = input.executionId.trim();
  if (!id) {
    return buildRuntimeExecutionApiErrorResponse(
      "mock_run",
      400,
      "invalid_execution_id",
      "executionId is required",
    );
  }

  const record = input.store.get(id);
  if (!record) {
    return buildRuntimeExecutionApiErrorResponse(
      "mock_run",
      404,
      "execution_not_found",
      `Execution not found: ${id}`,
    );
  }

  if (record.status !== "validated") {
    return buildRuntimeExecutionApiErrorResponse(
      "mock_run",
      409,
      "invalid_status",
      `Mock run requires validated status; current status is ${record.status}`,
    );
  }

  const request = input.store.getRequest(id);
  if (!request) {
    return buildRuntimeExecutionApiErrorResponse(
      "mock_run",
      409,
      "request_metadata_missing",
      `Request metadata missing for ${id}`,
    );
  }

  if (request.approvedForMockRun !== true) {
    return buildRuntimeExecutionApiErrorResponse(
      "mock_run",
      409,
      "mock_run_not_approved",
      "Mock run requires approvedForMockRun=true",
    );
  }

  if (request.actualExecutionRequested !== false) {
    return buildRuntimeExecutionApiErrorResponse(
      "mock_run",
      409,
      "actual_execution_requested",
      "Actual execution is not allowed in Stage 9-A",
    );
  }

  const auditEventCountBefore = input.store.getAuditEvents(id).length;
  const statusBefore = record.status;
  const mockResult = runMockRuntimeExecution({ request, record, nowIso: input.nowIso });

  let finalRecord = record;
  if (mockResult.success) {
    const running = transitionRuntimeExecutionRecord(record, "mock_running", input.nowIso);
    input.store.update(running);
    input.store.appendAudit(
      buildRuntimeExecutionAuditEvent({
        executionId: running.executionId,
        requestId: running.requestId,
        eventType: "mock_runner_started",
        statusBefore: record.status,
        statusAfter: "mock_running",
        message: "Mock runner started via Stage 9-A adapter.",
        nowIso: input.nowIso,
        sequence: input.store.getAuditEvents(id).length,
      }),
    );
    finalRecord = transitionRuntimeExecutionRecord(running, "mock_completed", input.nowIso);
  } else {
    finalRecord = transitionRuntimeExecutionRecord(record, "mock_failed", input.nowIso);
  }
  input.store.update(finalRecord);

  for (const [index, event] of mockResult.auditEvents.entries()) {
    input.store.appendAudit({
      ...event,
      auditEventId: `audit-${event.executionId}-${event.eventType}-api-mock-${index}`,
    });
  }

  if (mockResult.success) {
    input.store.appendAudit(
      buildRuntimeExecutionAuditEvent({
        executionId: finalRecord.executionId,
        requestId: finalRecord.requestId,
        eventType: "runtime_boundary_checked",
        statusAfter: "mock_completed",
        message: "Stage 9-A API mock run completed with no external side effects.",
        nowIso: input.nowIso,
        sequence: input.store.getAuditEvents(id).length,
      }),
    );
  } else {
    input.store.appendAudit(
      buildRuntimeExecutionAuditEvent({
        executionId: finalRecord.executionId,
        requestId: finalRecord.requestId,
        eventType: "mock_runner_failed",
        statusBefore,
        statusAfter: "mock_failed",
        message: mockResult.message,
        nowIso: input.nowIso,
        sequence: input.store.getAuditEvents(id).length,
      }),
    );
  }

  const auditEventCountAfter = input.store.getAuditEvents(id).length;
  const data: RuntimeExecutionApiMvpMockRunResult = {
    executionId: finalRecord.executionId,
    statusBefore,
    statusAfter: finalRecord.status,
    success: mockResult.success,
    auditEvents: input.store.getAuditEvents(id),
    auditEventCountBefore,
    auditEventCountAfter,
    externalSideEffect: false,
    actualRunnerInvoked: false,
  };

  if (!mockResult.success) {
    return {
      ...buildRuntimeExecutionApiErrorResponse("mock_run", 409, "mock_run_failed", mockResult.message),
      data,
    };
  }

  return buildRuntimeExecutionApiOkResponse("mock_run", 200, data);
}
