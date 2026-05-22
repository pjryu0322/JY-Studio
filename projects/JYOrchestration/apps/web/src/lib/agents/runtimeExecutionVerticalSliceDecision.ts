/**
 * Stage 8-A runtime execution vertical slice decision (read-only).
 */

import type {
  RuntimeExecutionVerticalSliceDecision,
  RuntimeExecutionVerticalSliceInput,
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
