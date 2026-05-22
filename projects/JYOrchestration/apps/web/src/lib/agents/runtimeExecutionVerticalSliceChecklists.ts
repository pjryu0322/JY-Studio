/**
 * Stage 8-A runtime execution vertical slice checklists (read-only).
 */

import type {
  RuntimeExecutionMockRunnerResult,
  RuntimeExecutionVerticalSliceChecklistItem,
} from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

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
