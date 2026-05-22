/**
 * Stage 9-A mock runner adapter (Stage 8-A mock runner only).
 */

import { buildRuntimeExecutionAuditEvent } from "@/lib/agents/runtimeExecutionVerticalSliceAudit";
import { runMockRuntimeExecution } from "@/lib/agents/runtimeExecutionVerticalSliceRunner";
import { buildRuntimeExecutionApiBoundaryReport } from "@/lib/agents/runtimeExecutionApiMvpBoundary";
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
  const boundary = buildRuntimeExecutionApiBoundaryReport();
  const id = input.executionId.trim();
  if (!id) {
    return {
      ok: false,
      status: 400,
      action: "mock_run",
      error: { code: "invalid_execution_id", message: "executionId is required" },
      boundary,
    };
  }

  const record = input.store.get(id);
  if (!record) {
    return {
      ok: false,
      status: 404,
      action: "mock_run",
      error: { code: "execution_not_found", message: `Execution not found: ${id}` },
      boundary,
    };
  }

  if (record.status !== "validated") {
    return {
      ok: false,
      status: 409,
      action: "mock_run",
      error: {
        code: "invalid_status",
        message: `Mock run requires validated status; current status is ${record.status}`,
      },
      boundary,
    };
  }

  const request = input.store.getRequest(id);
  if (!request) {
    return {
      ok: false,
      status: 404,
      action: "mock_run",
      error: { code: "request_not_found", message: `Request metadata not found for ${id}` },
      boundary,
    };
  }

  const statusBefore = record.status;
  const mockResult = runMockRuntimeExecution({ request, record, nowIso: input.nowIso });

  let finalRecord = record;
  if (mockResult.success) {
    const running = transitionRuntimeExecutionRecord(record, "mock_running", input.nowIso);
    input.store.update(running);
    finalRecord = transitionRuntimeExecutionRecord(running, "mock_completed", input.nowIso);
  } else {
    finalRecord = transitionRuntimeExecutionRecord(record, "mock_failed", input.nowIso);
  }
  input.store.update(finalRecord);

  const storedAuditEvents = [...mockResult.auditEvents];
  for (const [index, event] of mockResult.auditEvents.entries()) {
    const stored = input.store.appendAudit({
      ...event,
      auditEventId: `audit-${event.executionId}-${event.eventType}-api-${index}`,
    });
    storedAuditEvents[index] = stored;
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
  }

  const data: RuntimeExecutionApiMvpMockRunResult = {
    executionId: finalRecord.executionId,
    statusBefore,
    statusAfter: finalRecord.status,
    success: mockResult.success,
    auditEvents: input.store.getAuditEvents(id),
  };

  return {
    ok: mockResult.success,
    status: mockResult.success ? 200 : 409,
    action: "mock_run",
    data,
    boundary,
  };
}
