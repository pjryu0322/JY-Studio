/**
 * H31.5 — no-op execution shell **boundary violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopExecutionShellBoundaryViolationReport,
  RuntimeNoopExecutionShellPolicy,
  RuntimeNoopExecutionShellReadinessChecklist,
  RuntimeNoopExecutionShellScope,
  RuntimeNoopExecutionShellSummary,
} from "./runtimeNoopExecutionShellTypes";

const RISK_PHRASES: readonly { readonly phrase: string; readonly label: string }[] = [
  { phrase: "noopshellexecution=true", label: "noopShellExecution=true" },
  { phrase: "executionshellexecution=true", label: "executionShellExecution=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "runtimeadapterinvocation=true", label: "runtimeAdapterInvocation=true" },
  { phrase: "providerrouting=true", label: "providerRouting=true" },
  { phrase: "queuecontrol=true", label: "queueControl=true" },
  { phrase: "rollbackexecution=true", label: "rollbackExecution=true" },
  { phrase: "isolatedrunnerinvocation=true", label: "isolatedRunnerInvocation=true" },
  { phrase: "dryrunrunnerinvocation=true", label: "dryRunRunnerInvocation=true" },
  { phrase: "actualnoopshellexecutionenabled=true", label: "actualNoopShellExecutionEnabled=true" },
  { phrase: "actualexecutionshellexecutionenabled=true", label: "actualExecutionShellExecutionEnabled=true" },
  { phrase: "actualexecutionenabled=true", label: "actualExecutionEnabled=true" },
  { phrase: "actualruntimeadapterinvocationenabled=true", label: "actualRuntimeAdapterInvocationEnabled=true" },
  { phrase: "actualproviderroutingenabled=true", label: "actualProviderRoutingEnabled=true" },
  { phrase: "actualqueuecontrolenabled=true", label: "actualQueueControlEnabled=true" },
  { phrase: "actualrollbackexecutionenabled=true", label: "actualRollbackExecutionEnabled=true" },
  { phrase: "actualisolatedrunnerinvocationenabled=true", label: "actualIsolatedRunnerInvocationEnabled=true" },
  { phrase: "actualdryrunrunnerinvocationenabled=true", label: "actualDryRunRunnerInvocationEnabled=true" },
];

function collectBlob(
  summary: RuntimeNoopExecutionShellSummary,
  scope: RuntimeNoopExecutionShellScope,
  policy: RuntimeNoopExecutionShellPolicy,
  checklist: RuntimeNoopExecutionShellReadinessChecklist
): string {
  const parts: string[] = [
    summary.rationaleKo,
    ...summary.shellBlockers,
    ...summary.recommendations,
    ...scope.forbiddenShellOperations,
    ...scope.recommendations,
    ...policy.recommendations,
    ...checklist.checklist,
    ...checklist.recommendations,
  ];
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function detectRuntimeNoopExecutionShellBoundaryViolations(input: {
  readonly summary: RuntimeNoopExecutionShellSummary;
  readonly scope: RuntimeNoopExecutionShellScope;
  readonly policy: RuntimeNoopExecutionShellPolicy;
  readonly checklist: RuntimeNoopExecutionShellReadinessChecklist;
}): RuntimeNoopExecutionShellBoundaryViolationReport {
  const { summary, scope, policy, checklist } = input;
  const actualFlagViolations: string[] = [];
  const wordingRiskFindings: string[] = [];

  if (summary.actualNoopShellExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeNoopExecutionShellSummary.actualNoopShellExecutionEnabled must be false");
  }
  if (summary.actualExecutionShellExecutionEnabled !== false) {
    actualFlagViolations.push(
      "runtimeNoopExecutionShellSummary.actualExecutionShellExecutionEnabled must be false"
    );
  }
  if (summary.actualExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeNoopExecutionShellSummary.actualExecutionEnabled must be false");
  }
  if (summary.actualRuntimeAdapterInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeNoopExecutionShellSummary.actualRuntimeAdapterInvocationEnabled must be false"
    );
  }
  if (summary.actualProviderRoutingEnabled !== false) {
    actualFlagViolations.push("runtimeNoopExecutionShellSummary.actualProviderRoutingEnabled must be false");
  }
  if (summary.actualQueueControlEnabled !== false) {
    actualFlagViolations.push("runtimeNoopExecutionShellSummary.actualQueueControlEnabled must be false");
  }
  if (summary.actualRollbackExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeNoopExecutionShellSummary.actualRollbackExecutionEnabled must be false");
  }
  if (summary.actualIsolatedRunnerInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeNoopExecutionShellSummary.actualIsolatedRunnerInvocationEnabled must be false"
    );
  }
  if (summary.actualDryRunRunnerInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeNoopExecutionShellSummary.actualDryRunRunnerInvocationEnabled must be false"
    );
  }
  if (policy.actualShellExecutionForbidden !== true) {
    actualFlagViolations.push("runtimeNoopExecutionShellPolicy.actualShellExecutionForbidden must be true");
  }
  if (policy.actualExecutionForbidden !== true) {
    actualFlagViolations.push("runtimeNoopExecutionShellPolicy.actualExecutionForbidden must be true");
  }
  if (policy.actualAdapterInvocationForbidden !== true) {
    actualFlagViolations.push("runtimeNoopExecutionShellPolicy.actualAdapterInvocationForbidden must be true");
  }
  if (policy.actualRunnerInvocationForbidden !== true) {
    actualFlagViolations.push("runtimeNoopExecutionShellPolicy.actualRunnerInvocationForbidden must be true");
  }

  const blob = collectBlob(summary, scope, policy, checklist);
  for (const { phrase, label } of RISK_PHRASES) {
    if (blob.includes(phrase)) {
      wordingRiskFindings.push(`wording/flag risk: ${label}`);
    }
  }

  const recommendations = mergeSortedUniqueKo([
    ...(actualFlagViolations.length > 0 || wordingRiskFindings.length > 0
      ? ["H31.5: execution shell boundary violation — actual shell execution·invocation 플래그·문구 제거"]
      : []),
  ]);

  return {
    mode: "runtime_noop_execution_shell_boundary_violation_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualFlagViolations: mergeSortedUniqueKo(actualFlagViolations),
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations,
  };
}
