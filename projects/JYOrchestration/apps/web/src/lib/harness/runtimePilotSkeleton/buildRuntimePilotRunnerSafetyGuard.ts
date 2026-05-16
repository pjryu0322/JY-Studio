/**
 * H28 — runner **safety guard** metadata(read-only; enforcement 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimePilotRunnerSafetyGuard } from "./runtimePilotSkeletonTypes";

export function buildRuntimePilotRunnerSafetyGuard(): RuntimePilotRunnerSafetyGuard {
  const guardRows = mergeSortedUniqueKo([
    "actualExecutionForbidden:true",
    "actualAdapterInvocationForbidden:true",
    "actualProviderRoutingForbidden:true",
    "actualQueueControlForbidden:true",
    "actualRollbackForbidden:true",
    "actualPromptMutationForbidden:true",
    "actualIsolatedRunnerExecutionEnabled:false",
    "actualDryRunRunnerExecutionEnabled:false",
  ]);

  return {
    mode: "runtime_pilot_runner_safety_guard",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotActivationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualExecutionForbidden: true,
    actualAdapterInvocationForbidden: true,
    actualProviderRoutingForbidden: true,
    actualQueueControlForbidden: true,
    actualRollbackForbidden: true,
    actualPromptMutationForbidden: true,
    guardRows,
    recommendations: mergeSortedUniqueKo([
      "H28: runner safety guard — 모든 actual runner·execution 경로 금지(메타만)",
    ]),
  };
}
