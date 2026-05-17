/**
 * H34.5 — release-gate **boundary violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopShellReleaseGateBoundaryViolationReport,
  RuntimeNoopShellReleaseGatePolicy,
  RuntimeNoopShellReleaseGateSummary,
} from "./runtimeNoopShellReleaseGateTypes";

const RISK_PHRASES: readonly { readonly phrase: string; readonly label: string }[] = [
  { phrase: "releaseenforcement=true", label: "releaseEnforcement=true" },
  { phrase: "noopshellexecution=true", label: "noopShellExecution=true" },
  { phrase: "executionshellexecution=true", label: "executionShellExecution=true" },
  { phrase: "runtimeadapterinvocation=true", label: "runtimeAdapterInvocation=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "providerrouting=true", label: "providerRouting=true" },
  { phrase: "queuecontrol=true", label: "queueControl=true" },
  { phrase: "rollbackexecution=true", label: "rollbackExecution=true" },
  { phrase: "mergeblocking=true", label: "mergeBlocking=true" },
  { phrase: "actualnoopshellexecutionenabled=true", label: "actualNoopShellExecutionEnabled=true" },
  { phrase: "actualexecutionshellexecutionenabled=true", label: "actualExecutionShellExecutionEnabled=true" },
  { phrase: "actualruntimeadapterinvocationenabled=true", label: "actualRuntimeAdapterInvocationEnabled=true" },
  { phrase: "actualexecutionenabled=true", label: "actualExecutionEnabled=true" },
  { phrase: "actualproviderroutingenabled=true", label: "actualProviderRoutingEnabled=true" },
  { phrase: "actualqueuecontrolenabled=true", label: "actualQueueControlEnabled=true" },
  { phrase: "actualrollbackexecutionenabled=true", label: "actualRollbackExecutionEnabled=true" },
];

function collectBlob(summary: RuntimeNoopShellReleaseGateSummary, policy: RuntimeNoopShellReleaseGatePolicy): string {
  return [
    summary.rationaleKo,
    ...summary.releaseGateBlockers,
    ...summary.recommendations,
    ...policy.recommendations,
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function detectRuntimeNoopShellReleaseGateBoundaryViolations(input: {
  readonly summary: RuntimeNoopShellReleaseGateSummary;
  readonly policy: RuntimeNoopShellReleaseGatePolicy;
}): RuntimeNoopShellReleaseGateBoundaryViolationReport {
  const { summary, policy } = input;
  const actualFlagViolations: string[] = [];
  const wordingRiskFindings: string[] = [];

  if (summary.actualNoopShellExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeNoopShellReleaseGateSummary.actualNoopShellExecutionEnabled must be false");
  }
  if (summary.actualExecutionShellExecutionEnabled !== false) {
    actualFlagViolations.push(
      "runtimeNoopShellReleaseGateSummary.actualExecutionShellExecutionEnabled must be false"
    );
  }
  if (summary.actualRuntimeAdapterInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeNoopShellReleaseGateSummary.actualRuntimeAdapterInvocationEnabled must be false"
    );
  }
  if (summary.actualExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeNoopShellReleaseGateSummary.actualExecutionEnabled must be false");
  }
  if (summary.actualProviderRoutingEnabled !== false) {
    actualFlagViolations.push("runtimeNoopShellReleaseGateSummary.actualProviderRoutingEnabled must be false");
  }
  if (summary.actualQueueControlEnabled !== false) {
    actualFlagViolations.push("runtimeNoopShellReleaseGateSummary.actualQueueControlEnabled must be false");
  }
  if (summary.actualRollbackExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeNoopShellReleaseGateSummary.actualRollbackExecutionEnabled must be false");
  }
  if (policy.actualReleaseEnforcementForbidden !== true) {
    actualFlagViolations.push("runtimeNoopShellReleaseGatePolicy.actualReleaseEnforcementForbidden must be true");
  }
  if (policy.actualShellExecutionForbidden !== true) {
    actualFlagViolations.push("runtimeNoopShellReleaseGatePolicy.actualShellExecutionForbidden must be true");
  }
  if (policy.actualExecutionForbidden !== true) {
    actualFlagViolations.push("runtimeNoopShellReleaseGatePolicy.actualExecutionForbidden must be true");
  }
  if (policy.actualAdapterInvocationForbidden !== true) {
    actualFlagViolations.push("runtimeNoopShellReleaseGatePolicy.actualAdapterInvocationForbidden must be true");
  }

  const blob = collectBlob(summary, policy);
  for (const { phrase, label } of RISK_PHRASES) {
    if (blob.includes(phrase)) {
      wordingRiskFindings.push(`wording/flag risk: ${label}`);
    }
  }

  const recommendations = mergeSortedUniqueKo([
    ...(actualFlagViolations.length > 0 || wordingRiskFindings.length > 0
      ? ["H34.5: release-gate boundary violation — actual release enforcement·shell execution 플래그·문구 제거"]
      : []),
  ]);

  return {
    mode: "runtime_noop_shell_release_gate_boundary_violation_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    actualFlagViolations: mergeSortedUniqueKo(actualFlagViolations),
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations,
  };
}
