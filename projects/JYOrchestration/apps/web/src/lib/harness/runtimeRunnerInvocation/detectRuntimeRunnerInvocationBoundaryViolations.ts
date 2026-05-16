/**
 * H29.5 — runner invocation **boundary violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeRunnerInvocationBoundaryViolationReport,
  RuntimeRunnerInvocationPolicy,
  RuntimeRunnerInvocationReadinessChecklist,
  RuntimeRunnerInvocationScope,
  RuntimeRunnerInvocationSummary,
} from "./runtimeRunnerInvocationTypes";

const RISK_PHRASES: readonly { readonly phrase: string; readonly label: string }[] = [
  { phrase: "isolatedrunnerinvocation=true", label: "isolatedRunnerInvocation=true" },
  { phrase: "isolatedrunnerexecution=true", label: "isolatedRunnerExecution=true" },
  { phrase: "dryrunrunnerinvocation=true", label: "dryRunRunnerInvocation=true" },
  { phrase: "dryrunrunnerexecution=true", label: "dryRunRunnerExecution=true" },
  { phrase: "runtimeadapterinvocation=true", label: "runtimeAdapterInvocation=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "providerrouting=true", label: "providerRouting=true" },
  { phrase: "queuecontrol=true", label: "queueControl=true" },
  { phrase: "rollbackexecution=true", label: "rollbackExecution=true" },
  { phrase: "actualisolatedrunnerinvocationenabled=true", label: "actualIsolatedRunnerInvocationEnabled=true" },
  { phrase: "actualisolatedrunnerexecutionenabled=true", label: "actualIsolatedRunnerExecutionEnabled=true" },
  { phrase: "actualdryrunrunnerinvocationenabled=true", label: "actualDryRunRunnerInvocationEnabled=true" },
  { phrase: "actualdryrunrunnerexecutionenabled=true", label: "actualDryRunRunnerExecutionEnabled=true" },
  { phrase: "actualruntimeadapterinvocationenabled=true", label: "actualRuntimeAdapterInvocationEnabled=true" },
  { phrase: "actualexecutionenabled=true", label: "actualExecutionEnabled=true" },
  { phrase: "actualproviderroutingenabled=true", label: "actualProviderRoutingEnabled=true" },
  { phrase: "actualqueuecontrolenabled=true", label: "actualQueueControlEnabled=true" },
  { phrase: "actualrollbackexecutionenabled=true", label: "actualRollbackExecutionEnabled=true" },
];

function collectBlob(
  summary: RuntimeRunnerInvocationSummary,
  scope: RuntimeRunnerInvocationScope,
  policy: RuntimeRunnerInvocationPolicy,
  checklist: RuntimeRunnerInvocationReadinessChecklist
): string {
  const parts: string[] = [
    summary.rationaleKo,
    ...summary.invocationBlockers,
    ...summary.recommendations,
    ...scope.forbiddenInvocationOperations,
    ...scope.recommendations,
    ...policy.recommendations,
    ...checklist.checklist,
    ...checklist.recommendations,
  ];
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function detectRuntimeRunnerInvocationBoundaryViolations(input: {
  readonly summary: RuntimeRunnerInvocationSummary;
  readonly scope: RuntimeRunnerInvocationScope;
  readonly policy: RuntimeRunnerInvocationPolicy;
  readonly checklist: RuntimeRunnerInvocationReadinessChecklist;
}): RuntimeRunnerInvocationBoundaryViolationReport {
  const { summary, scope, policy, checklist } = input;
  const actualFlagViolations: string[] = [];
  const wordingRiskFindings: string[] = [];

  if (summary.actualIsolatedRunnerInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeRunnerInvocationSummary.actualIsolatedRunnerInvocationEnabled must be false"
    );
  }
  if (summary.actualIsolatedRunnerExecutionEnabled !== false) {
    actualFlagViolations.push(
      "runtimeRunnerInvocationSummary.actualIsolatedRunnerExecutionEnabled must be false"
    );
  }
  if (summary.actualDryRunRunnerInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeRunnerInvocationSummary.actualDryRunRunnerInvocationEnabled must be false"
    );
  }
  if (summary.actualDryRunRunnerExecutionEnabled !== false) {
    actualFlagViolations.push(
      "runtimeRunnerInvocationSummary.actualDryRunRunnerExecutionEnabled must be false"
    );
  }
  if (summary.actualRuntimeAdapterInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeRunnerInvocationSummary.actualRuntimeAdapterInvocationEnabled must be false"
    );
  }
  if (summary.actualExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeRunnerInvocationSummary.actualExecutionEnabled must be false");
  }
  if (summary.actualProviderRoutingEnabled !== false) {
    actualFlagViolations.push("runtimeRunnerInvocationSummary.actualProviderRoutingEnabled must be false");
  }
  if (summary.actualQueueControlEnabled !== false) {
    actualFlagViolations.push("runtimeRunnerInvocationSummary.actualQueueControlEnabled must be false");
  }
  if (summary.actualRollbackExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeRunnerInvocationSummary.actualRollbackExecutionEnabled must be false");
  }
  if (policy.actualInvocationForbidden !== true) {
    actualFlagViolations.push("runtimeRunnerInvocationPolicy.actualInvocationForbidden must be true");
  }

  const blob = collectBlob(summary, scope, policy, checklist);
  for (const { phrase, label } of RISK_PHRASES) {
    if (blob.includes(phrase)) {
      wordingRiskFindings.push(`wording/flag risk: ${label}`);
    }
  }

  const recommendations = mergeSortedUniqueKo([
    ...(actualFlagViolations.length > 0 || wordingRiskFindings.length > 0
      ? ["H29.5: runner invocation boundary violation — actual invocation·execution 플래그·문구 제거"]
      : []),
  ]);

  return {
    mode: "runtime_runner_invocation_boundary_violation_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualFlagViolations: mergeSortedUniqueKo(actualFlagViolations),
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations,
  };
}
