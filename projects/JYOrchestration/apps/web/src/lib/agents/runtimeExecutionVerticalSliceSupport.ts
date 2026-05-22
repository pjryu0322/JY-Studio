/**
 * Stage 8-A runtime execution vertical slice support.
 */

import {
  REQUIRED_STAGE8_A_CONFIRMATIONS,
  STAGE8_A_DEFAULT_NOW_ISO,
} from "@/lib/agents/runtimeExecutionVerticalSliceConstants";
import type {
  RuntimeExecutionRequest,
  RuntimeExecutionVerticalSliceChecklistItem,
  RuntimeExecutionVerticalSliceDecision,
  RuntimeExecutionVerticalSliceInput,
  RuntimeExecutionMockRunnerResult,
} from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

export type ParsedRuntimeExecutionVerticalSliceInput = {
  readonly operatorStage8ApprovalConfirmed: boolean;
  readonly scopeBoundaryConfirmed: boolean;
  readonly mockRunnerOnlyConfirmed: boolean;
  readonly inMemoryOnlyConfirmed: boolean;
  readonly noExternalSideEffectConfirmed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
};

export function parseRuntimeExecutionVerticalSliceInput(
  input?: RuntimeExecutionVerticalSliceInput,
): ParsedRuntimeExecutionVerticalSliceInput {
  const flags = [
    input?.operatorStage8ApprovalConfirmed === true,
    input?.scopeBoundaryConfirmed === true,
    input?.mockRunnerOnlyConfirmed === true,
    input?.inMemoryOnlyConfirmed === true,
    input?.noExternalSideEffectConfirmed === true,
  ];
  return {
    operatorStage8ApprovalConfirmed: flags[0],
    scopeBoundaryConfirmed: flags[1],
    mockRunnerOnlyConfirmed: flags[2],
    inMemoryOnlyConfirmed: flags[3],
    noExternalSideEffectConfirmed: flags[4],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

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

export function resolveRuntimeExecutionVerticalSliceDecision(input: {
  readonly sourceStage7Decision: string;
  readonly sourceStage8EntryReady: boolean;
  readonly requestValid: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly mockRunnerSuccess: boolean;
  readonly actualExecutionRequested: boolean;
  readonly externalSideEffect: boolean;
}): RuntimeExecutionVerticalSliceDecision {
  if (input.sourceStage7Decision !== "stage7_runtime_contract_bundle_closed") {
    return "defer";
  }

  if (input.sourceStage8EntryReady !== true) {
    return "defer";
  }

  if (input.actualExecutionRequested !== false || input.externalSideEffect !== false) {
    return "blocked";
  }

  if (!input.requestValid) {
    return "blocked";
  }

  if (!input.confirmationsSatisfied) {
    return "defer";
  }

  if (!input.mockRunnerSuccess) {
    return "blocked";
  }

  return "stage8_minimal_vertical_slice_ready";
}

export function buildRuntimeExecutionVerticalSliceFingerprint(input: {
  readonly sourceStage7Decision: string;
  readonly requestId: string;
  readonly finalStatus: string;
  readonly auditEventCount: number;
  readonly confirmationCount: number;
}): string {
  return [
    "runtime-execution-vertical-slice-v1",
    input.sourceStage7Decision,
    `requestId:${input.requestId}`,
    `finalStatus:${input.finalStatus}`,
    `auditEvents:${input.auditEventCount}`,
    `confirmations:${input.confirmationCount}`,
  ].join("::");
}

export function buildRuntimeExecutionVerticalSliceSummary(
  decision: RuntimeExecutionVerticalSliceDecision,
): string {
  if (decision === "blocked") {
    return "Stage 8-A minimal runtime execution vertical slice is blocked.";
  }
  if (decision === "defer") {
    return "Stage 8-A vertical slice defers; Stage 7-C closure or confirmations are incomplete.";
  }
  return "In-memory runtime execution vertical slice is ready. External API, runner, DB, and UI remain disallowed.";
}

export function buildRuntimeExecutionVerticalSliceChecklists(input: {
  readonly sourceStage8EntryReady: boolean;
  readonly requestValid: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly mockRunnerResult: RuntimeExecutionMockRunnerResult;
}): {
  readonly checklist: readonly RuntimeExecutionVerticalSliceChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionVerticalSliceChecklistItem[];
} {
  const checklist: RuntimeExecutionVerticalSliceChecklistItem[] = [
    {
      item: "stage7_contract_bundle_closed",
      satisfied: input.sourceStage8EntryReady,
      reason: "sourceStage8EntryReady",
    },
    {
      item: "runtime_execution_request_valid",
      satisfied: input.requestValid,
      reason: "requestValid",
    },
    {
      item: "stage8_confirmations_satisfied",
      satisfied: input.confirmationsSatisfied,
      reason: "confirmationsSatisfied",
    },
    {
      item: "mock_runner_success",
      satisfied: input.mockRunnerResult.success,
      reason: "mockRunnerResult.success",
    },
  ];

  const boundaryChecklist: RuntimeExecutionVerticalSliceChecklistItem[] = [
    {
      item: "actualRunnerInvoked=false",
      satisfied: input.mockRunnerResult.actualRunnerInvoked === false,
      reason: "mockRunnerResult.actualRunnerInvoked",
    },
    {
      item: "externalSideEffect=false",
      satisfied: input.mockRunnerResult.externalSideEffect === false,
      reason: "mockRunnerResult.externalSideEffect",
    },
    {
      item: "in_memory_only",
      satisfied: true,
      reason: "Stage 8-A in-memory scope",
    },
  ];

  return { checklist, boundaryChecklist };
}

export { REQUIRED_STAGE8_A_CONFIRMATIONS };
