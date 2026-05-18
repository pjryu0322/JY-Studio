/**
 * H36.5 — execution boundary shell **boundary violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeExecutionBoundaryShellBoundaryViolationReport,
  RuntimeExecutionBoundaryShellPolicy,
  RuntimeExecutionBoundaryShellSummary,
} from "./runtimeExecutionBoundaryShellTypes";

const RISK_PHRASES: readonly { readonly phrase: string; readonly label: string }[] = [
  { phrase: "actualexecutionenabled=true", label: "actualExecutionEnabled=true" },
  { phrase: "actualexecutionroutingenabled=true", label: "actualExecutionRoutingEnabled=true" },
  { phrase: "actualexecutionroutingforbidden=false", label: "actualExecutionRoutingForbidden=false" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "releaseenforced=true", label: "releaseEnforced=true" },
  { phrase: "providerrouting=true", label: "providerRouting=true" },
  { phrase: "queuecontrol=true", label: "queueControl=true" },
  { phrase: "rollbackexecution=true", label: "rollbackExecution=true" },
  { phrase: "runtimeadapterinvocation=true", label: "runtimeAdapterInvocation=true" },
  { phrase: "noopshellexecution=true", label: "noopShellExecution=true" },
  { phrase: "executionshellexecution=true", label: "executionShellExecution=true" },
  { phrase: "actualreleaseenforcementenabled=true", label: "actualReleaseEnforcementEnabled=true" },
  { phrase: "actualnoopshellexecutionenabled=true", label: "actualNoopShellExecutionEnabled=true" },
  { phrase: "actualexecutionshellexecutionenabled=true", label: "actualExecutionShellExecutionEnabled=true" },
  { phrase: "actualruntimeadapterinvocationenabled=true", label: "actualRuntimeAdapterInvocationEnabled=true" },
  { phrase: "actualproviderroutingenabled=true", label: "actualProviderRoutingEnabled=true" },
  { phrase: "actualqueuecontrolenabled=true", label: "actualQueueControlEnabled=true" },
  { phrase: "actualrollbackexecutionenabled=true", label: "actualRollbackExecutionEnabled=true" },
];

function collectBlob(summary: RuntimeExecutionBoundaryShellSummary, policy: RuntimeExecutionBoundaryShellPolicy): string {
  return [summary.rationaleKo, ...summary.shellBlockers, ...summary.recommendations, ...policy.recommendations]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function detectRuntimeExecutionBoundaryShellBoundaryViolations(input: {
  readonly summary: RuntimeExecutionBoundaryShellSummary;
  readonly policy: RuntimeExecutionBoundaryShellPolicy;
}): RuntimeExecutionBoundaryShellBoundaryViolationReport {
  const { summary, policy } = input;
  const actualFlagViolations: string[] = [];

  if (summary.actualExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeExecutionBoundaryShellSummary.actualExecutionEnabled must be false");
  }
  if (summary.actualProviderRoutingEnabled !== false) {
    actualFlagViolations.push("runtimeExecutionBoundaryShellSummary.actualProviderRoutingEnabled must be false");
  }
  if (summary.actualQueueControlEnabled !== false) {
    actualFlagViolations.push("runtimeExecutionBoundaryShellSummary.actualQueueControlEnabled must be false");
  }
  if (summary.actualRollbackExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeExecutionBoundaryShellSummary.actualRollbackExecutionEnabled must be false");
  }
  if (summary.actualReleaseEnforcementEnabled !== false) {
    actualFlagViolations.push("runtimeExecutionBoundaryShellSummary.actualReleaseEnforcementEnabled must be false");
  }
  if (summary.actualNoopShellExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeExecutionBoundaryShellSummary.actualNoopShellExecutionEnabled must be false");
  }
  if (summary.actualExecutionShellExecutionEnabled !== false) {
    actualFlagViolations.push(
      "runtimeExecutionBoundaryShellSummary.actualExecutionShellExecutionEnabled must be false"
    );
  }
  if (summary.actualRuntimeAdapterInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeExecutionBoundaryShellSummary.actualRuntimeAdapterInvocationEnabled must be false"
    );
  }
  if (policy.actualExecutionForbidden !== true) {
    actualFlagViolations.push("runtimeExecutionBoundaryShellPolicy.actualExecutionForbidden must be true");
  }
  if (policy.actualExecutionRoutingForbidden !== true) {
    actualFlagViolations.push("runtimeExecutionBoundaryShellPolicy.actualExecutionRoutingForbidden must be true");
  }
  if (policy.actualReleaseEnforcementForbidden !== true) {
    actualFlagViolations.push("runtimeExecutionBoundaryShellPolicy.actualReleaseEnforcementForbidden must be true");
  }
  if (policy.actualShellExecutionForbidden !== true) {
    actualFlagViolations.push("runtimeExecutionBoundaryShellPolicy.actualShellExecutionForbidden must be true");
  }
  if (policy.actualAdapterInvocationForbidden !== true) {
    actualFlagViolations.push("runtimeExecutionBoundaryShellPolicy.actualAdapterInvocationForbidden must be true");
  }
  if (policy.actualProviderRoutingForbidden !== true) {
    actualFlagViolations.push("runtimeExecutionBoundaryShellPolicy.actualProviderRoutingForbidden must be true");
  }
  if (policy.actualQueueControlForbidden !== true) {
    actualFlagViolations.push("runtimeExecutionBoundaryShellPolicy.actualQueueControlForbidden must be true");
  }
  if (policy.actualRollbackForbidden !== true) {
    actualFlagViolations.push("runtimeExecutionBoundaryShellPolicy.actualRollbackForbidden must be true");
  }

  const wordingRiskFindings: string[] = [];
  const blob = collectBlob(summary, policy);
  for (const { phrase, label } of RISK_PHRASES) {
    if (blob.includes(phrase)) {
      wordingRiskFindings.push(`wording/flag risk: ${label}`);
    }
  }

  const recommendations = mergeSortedUniqueKo([
    ...(actualFlagViolations.length > 0 || wordingRiskFindings.length > 0
      ? ["H36.5: execution boundary shell boundary violation — actual·routing·forbidden 플래그·문구 제거"]
      : []),
  ]);

  return {
    mode: "runtime_execution_boundary_shell_boundary_violation_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
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
