/**
 * Stage 9-A in-memory runtime execution approval action.
 */

import { buildRuntimeExecutionAuditEvent } from "@/lib/agents/runtimeExecutionVerticalSliceAudit";
import { buildRuntimeExecutionApiBoundaryReport } from "@/lib/agents/runtimeExecutionApiMvpBoundary";
import type { RuntimeExecutionApiMvpStore } from "@/lib/agents/runtimeExecutionApiMvpStore";
import { transitionRuntimeExecutionRecord } from "@/lib/agents/runtimeExecutionVerticalSliceStore";
import type {
  RuntimeExecutionApiMvpApprovalResult,
  RuntimeExecutionApiResponse,
} from "@/lib/agents/runtimeExecutionApiMvpTypes";

const TERMINAL_STATUSES = new Set(["mock_completed", "rollback_requested", "cancelled"]);

export function approveRuntimeExecutionInMemory(input: {
  readonly store: RuntimeExecutionApiMvpStore;
  readonly executionId: string;
  readonly approvedBy: "operator" | "system";
  readonly nowIso: string;
}): RuntimeExecutionApiResponse<RuntimeExecutionApiMvpApprovalResult> {
  const boundary = buildRuntimeExecutionApiBoundaryReport();
  const id = input.executionId.trim();
  if (!id) {
    return {
      ok: false,
      status: 400,
      action: "approve",
      error: { code: "invalid_execution_id", message: "executionId is required" },
      boundary,
    };
  }

  const record = input.store.get(id);
  if (!record) {
    return {
      ok: false,
      status: 404,
      action: "approve",
      error: { code: "execution_not_found", message: `Execution not found: ${id}` },
      boundary,
    };
  }

  if (TERMINAL_STATUSES.has(record.status)) {
    return {
      ok: false,
      status: 409,
      action: "approve",
      error: {
        code: "invalid_status",
        message: `Cannot approve execution in status ${record.status}`,
      },
      boundary,
    };
  }

  if (record.status === "validated") {
    return {
      ok: false,
      status: 409,
      action: "approve",
      error: { code: "already_approved", message: "Execution is already validated" },
      boundary,
    };
  }

  const statusBefore = record.status;
  const updated = transitionRuntimeExecutionRecord(record, "validated", input.nowIso);
  input.store.update(updated);

  const request = input.store.getRequest(id);
  if (request) {
    input.store.setRequest(id, { ...request, approvedForMockRun: true });
  }

  const auditEvent = buildRuntimeExecutionAuditEvent({
    executionId: updated.executionId,
    requestId: updated.requestId,
    eventType: "runtime_request_validated",
    statusBefore,
    statusAfter: "validated",
    message: `Approved in memory by ${input.approvedBy}.`,
    nowIso: input.nowIso,
    sequence: input.store.getAuditEvents(id).length,
  });
  input.store.appendAudit(auditEvent);

  const data: RuntimeExecutionApiMvpApprovalResult = {
    executionId: updated.executionId,
    approved: true,
    statusBefore,
    statusAfter: "validated",
    auditEvent,
  };

  return { ok: true, status: 200, action: "approve", data, boundary };
}
