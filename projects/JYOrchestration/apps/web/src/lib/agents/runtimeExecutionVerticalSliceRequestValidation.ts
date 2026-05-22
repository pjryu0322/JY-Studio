/**
 * Stage 8-A runtime execution request normalization and validation (read-only).
 */

import { STAGE8_A_DEFAULT_NOW_ISO } from "@/lib/agents/runtimeExecutionVerticalSliceConstants";
import type { RuntimeExecutionRequest } from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

export function normalizeRuntimeExecutionRequest(
  input?: Partial<RuntimeExecutionRequest>,
): RuntimeExecutionRequest {
  return {
    requestId: input?.requestId ?? "",
    projectId: input?.projectId ?? "",
    sourceStage: "stage_8_a",
    requestedBy: input?.requestedBy ?? "operator",
    unitKind: input?.unitKind ?? "mock_runner",
    commandPreview: input?.commandPreview ?? "",
    payloadPreview: input?.payloadPreview ?? "",
    createdAtIso: input?.createdAtIso ?? STAGE8_A_DEFAULT_NOW_ISO,
    approvedForMockRun: input?.approvedForMockRun === true,
    actualExecutionRequested: false,
  };
}

export function validateRuntimeExecutionRequest(request: RuntimeExecutionRequest): {
  readonly valid: boolean;
  readonly missingFields: readonly string[];
  readonly invalidFields: readonly string[];
} {
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  if (request.requestId.trim().length === 0) {
    missingFields.push("requestId");
  }
  if (request.projectId.trim().length === 0) {
    missingFields.push("projectId");
  }
  if (request.commandPreview.trim().length === 0) {
    missingFields.push("commandPreview");
  }
  if (request.actualExecutionRequested !== false) {
    invalidFields.push("actualExecutionRequested");
  }

  return {
    valid: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields,
  };
}
