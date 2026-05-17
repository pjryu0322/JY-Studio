/**
 * H43 — pilot **no-execution proof** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotReadinessReviewConstants";
import type { RuntimePilotNoExecutionProof } from "./runtimeLimitedPilotReadinessReviewTypes";

export function buildRuntimePilotNoExecutionProof(): RuntimePilotNoExecutionProof {
  const proofRows = mergeSortedUniqueKo([
    "pilotActivated:false",
    "pilotExecuted:false",
    "isolatedRunnerInvoked:false",
    "isolatedRunnerExecuted:false",
    "dryRunRunnerInvoked:false",
    "dryRunRunnerExecuted:false",
    "noopShellExecuted:false",
    "executionShellExecuted:false",
    "runtimeAdapterInvoked:false",
    "sandboxInvoked:false",
    "executionPerformed:false",
    "executionRoutingPerformed:false",
    "providerRoutingPerformed:false",
    "queueControlPerformed:false",
    "rollbackPerformed:false",
    "releaseEnforced:false",
    "approvalEnforced:false",
    "executionBlocked:false",
    "mergeBlocked:false",
    "promptMutated:false",
    "tokenEnforced:false",
    "contextPruned:false",
    "retrievalOrchestrated:false",
    "diagnosticOnly:true",
    "limitedPilotReadinessReview:metadata_only",
  ]);

  return {
    mode: "runtime_pilot_no_execution_proof",
    ...RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
    pilotActivated: false,
    pilotExecuted: false,
    isolatedRunnerInvoked: false,
    isolatedRunnerExecuted: false,
    dryRunRunnerInvoked: false,
    dryRunRunnerExecuted: false,
    noopShellExecuted: false,
    executionShellExecuted: false,
    runtimeAdapterInvoked: false,
    sandboxInvoked: false,
    executionPerformed: false,
    executionRoutingPerformed: false,
    providerRoutingPerformed: false,
    queueControlPerformed: false,
    rollbackPerformed: false,
    releaseEnforced: false,
    approvalEnforced: false,
    executionBlocked: false,
    mergeBlocked: false,
    promptMutated: false,
    tokenEnforced: false,
    contextPruned: false,
    retrievalOrchestrated: false,
    diagnosticOnly: true,
    proofRows,
    recommendations: mergeSortedUniqueKo([
      "H43: pilot no-execution proof — pilot·runner·adapter·sandbox·execution 경로 false",
    ]),
  };
}
