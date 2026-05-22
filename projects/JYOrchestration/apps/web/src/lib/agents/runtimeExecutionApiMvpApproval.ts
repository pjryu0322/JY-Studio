/**
 * Stage 9-A in-memory runtime execution approval action.
 */

import { buildRuntimeExecutionAuditEvent } from "@/lib/agents/runtimeExecutionVerticalSliceAudit";
import {
  buildRuntimeExecutionApiErrorResponse,
  buildRuntimeExecutionApiOkResponse,
} from "@/lib/agents/runtimeExecutionApiMvpResponse";
import type { RuntimeExecutionApiMvpStore } from "@/lib/agents/runtimeExecutionApiMvpStore";
import { transitionRuntimeExecutionRecord } from "@/lib/agents/runtimeExecutionVerticalSliceStore";
import type {
  RuntimeExecutionApiMvpApprovalResult,
  RuntimeExecutionApiResponse,
} from "@/lib/agents/runtimeExecutionApiMvpTypes";

export function approveRuntimeExecutionInMemory(input: {
  readonly store: RuntimeExecutionApiMvpStore;
  readonly executionId: string;
  readonly approvedBy: "operator" | "system";
  readonly nowIso: string;
}): RuntimeExecutionApiResponse<RuntimeExecutionApiMvpApprovalResult> {
  const id = input.executionId.trim();
  if (!id) {
    return buildRuntimeExecutionApiErrorResponse(
      "approve",
      400,
      "invalid_execution_id",
      "executionId is required",
    );
  }

  const record = input.store.get(id);
  if (!record) {
    return buildRuntimeExecutionApiErrorResponse(
      "approve",
      404,
      "execution_not_found",
      `Execution not found: ${id}`,
    );
  }

  const request = input.store.getRequest(id);
  if (!request) {
    return buildRuntimeExecutionApiErrorResponse(
      "approve",
      409,
      "request_metadata_missing",
      `Request metadata missing for ${id}`,
    );
  }

  if (record.status === "validated") {
    return buildRuntimeExecutionApiErrorResponse(
      "approve",
      409,
      "already_approved",
      "Execution is already validated",
    );
  }

  if (record.status !== "requested") {
    return buildRuntimeExecutionApiErrorResponse(
      "approve",
      409,
      "invalid_status",
      `Cannot approve execution in status ${record.status}`,
    );
  }

  const statusBefore = record.status;
  const updated = transitionRuntimeExecutionRecord(record, "validated", input.nowIso);
  input.store.update(updated);
  input.store.setRequest(id, { ...request, approvedForMockRun: true });

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

  return buildRuntimeExecutionApiOkResponse("approve", 200, data);
}
