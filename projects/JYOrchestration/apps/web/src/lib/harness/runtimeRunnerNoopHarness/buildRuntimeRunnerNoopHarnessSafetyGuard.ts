/**
 * H30 — no-op harness **safety guard** metadata(read-only; enforcement 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeRunnerNoopHarnessSafetyGuard } from "./runtimeRunnerNoopHarnessTypes";

export function buildRuntimeRunnerNoopHarnessSafetyGuard(): RuntimeRunnerNoopHarnessSafetyGuard {
  const guardRows = mergeSortedUniqueKo([
    "actualInvocationForbidden:true",
    "actualExecutionForbidden:true",
    "actualAdapterInvocationForbidden:true",
    "actualProviderRoutingForbidden:true",
    "actualQueueControlForbidden:true",
    "actualRollbackForbidden:true",
    "actualPromptMutationForbidden:true",
    "actualIsolatedRunnerInvocationEnabled:false",
    "actualDryRunRunnerInvocationEnabled:false",
  ]);

  return {
    mode: "runtime_runner_noop_harness_safety_guard",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    actualInvocationForbidden: true,
    actualExecutionForbidden: true,
    actualAdapterInvocationForbidden: true,
    actualProviderRoutingForbidden: true,
    actualQueueControlForbidden: true,
    actualRollbackForbidden: true,
    actualPromptMutationForbidden: true,
    guardRows,
    recommendations: mergeSortedUniqueKo([
      "H30: no-op harness safety guard — 모든 actual invocation·execution 경로 금지(메타만)",
    ]),
  };
}
