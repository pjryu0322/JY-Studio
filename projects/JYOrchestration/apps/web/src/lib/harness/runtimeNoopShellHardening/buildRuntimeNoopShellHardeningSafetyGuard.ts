/**
 * H32 ??shell hardening **safety guard** metadata(read-only; enforcement ?�음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeNoopShellHardeningSafetyGuard } from "./runtimeNoopShellHardeningTypes";

export function buildRuntimeNoopShellHardeningSafetyGuard(): RuntimeNoopShellHardeningSafetyGuard {
  const guardRows = mergeSortedUniqueKo([
    "actualShellExecutionForbidden:true",
    "actualAdapterInvocationForbidden:true",
    "actualExecutionForbidden:true",
    "actualProviderRoutingForbidden:true",
    "actualQueueControlForbidden:true",
    "actualRollbackForbidden:true",
    "actualPromptMutationForbidden:true",
    "actualNoopShellExecutionEnabled:false",
    "actualExecutionShellExecutionEnabled:false",
  ]);

  return {
    mode: "runtime_noop_shell_hardening_safety_guard",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    actualShellExecutionForbidden: true,
    actualAdapterInvocationForbidden: true,
    actualExecutionForbidden: true,
    actualProviderRoutingForbidden: true,
    actualQueueControlForbidden: true,
    actualRollbackForbidden: true,
    actualPromptMutationForbidden: true,
    guardRows,
    recommendations: mergeSortedUniqueKo([
      "H33: shell hardening safety guard ??actual shell execution·adapter·routing·rollback·prompt 변�?금�?",
    ]),
  };
}
