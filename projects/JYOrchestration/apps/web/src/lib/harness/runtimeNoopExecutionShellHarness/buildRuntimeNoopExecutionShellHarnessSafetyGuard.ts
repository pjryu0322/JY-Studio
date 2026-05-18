/**
 * H32 — execution shell harness **safety guard** metadata(read-only; enforcement 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeNoopExecutionShellHarnessSafetyGuard } from "./runtimeNoopExecutionShellHarnessTypes";

export function buildRuntimeNoopExecutionShellHarnessSafetyGuard(): RuntimeNoopExecutionShellHarnessSafetyGuard {
  const guardRows = mergeSortedUniqueKo([
    "actualShellExecutionForbidden:true",
    "actualExecutionForbidden:true",
    "actualAdapterInvocationForbidden:true",
    "actualProviderRoutingForbidden:true",
    "actualQueueControlForbidden:true",
    "actualRollbackForbidden:true",
    "actualPromptMutationForbidden:true",
    "actualTokenEnforcementForbidden:true",
    "actualContextPruningForbidden:true",
    "actualNoopShellExecutionEnabled:false",
    "actualExecutionShellExecutionEnabled:false",
  ]);

  return {
    mode: "runtime_noop_execution_shell_harness_safety_guard",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    actualShellExecutionForbidden: true,
    actualExecutionForbidden: true,
    actualAdapterInvocationForbidden: true,
    actualProviderRoutingForbidden: true,
    actualQueueControlForbidden: true,
    actualRollbackForbidden: true,
    actualPromptMutationForbidden: true,
    actualTokenEnforcementForbidden: true,
    actualContextPruningForbidden: true,
    guardRows,
    recommendations: mergeSortedUniqueKo([
      "H32: execution shell harness safety guard — actual shell execution·adapter·routing·rollback·prompt·token·context 금지",
    ]),
  };
}
