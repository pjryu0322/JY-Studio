/**
 * H30 — no-op harness **boundary violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeRunnerNoopHarnessBoundaryViolationReport,
  RuntimeRunnerNoopHarnessSafetyGuard,
  RuntimeRunnerNoopHarnessSummary,
  RuntimeRunnerNoopInvocationEnvelope,
  RuntimeRunnerNoopResultMetadata,
} from "./runtimeRunnerNoopHarnessTypes";

const RISK_PHRASES: readonly { readonly phrase: string; readonly label: string }[] = [
  { phrase: "isolatedrunnerinvocation=true", label: "isolatedRunnerInvocation=true" },
  { phrase: "isolatedrunnerexecuted=true", label: "isolatedRunnerExecuted=true" },
  { phrase: "isolatedrunnerinvoked=true", label: "isolatedRunnerInvoked=true" },
  { phrase: "dryrunrunnerinvocation=true", label: "dryRunRunnerInvocation=true" },
  { phrase: "dryrunrunnerexecuted=true", label: "dryRunRunnerExecuted=true" },
  { phrase: "dryrunrunnerinvoked=true", label: "dryRunRunnerInvoked=true" },
  { phrase: "runtimeadapterinvocation=true", label: "runtimeAdapterInvocation=true" },
  { phrase: "runtimeadapterinvoked=true", label: "runtimeAdapterInvoked=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "providerrouting=true", label: "providerRouting=true" },
  { phrase: "queuecontrol=true", label: "queueControl=true" },
  { phrase: "rollbackexecution=true", label: "rollbackExecution=true" },
  { phrase: "promptmutated=true", label: "promptMutated=true" },
  { phrase: "actualisolatedrunnerinvocationenabled=true", label: "actualIsolatedRunnerInvocationEnabled=true" },
  { phrase: "actualisolatedrunnerexecutionenabled=true", label: "actualIsolatedRunnerExecutionEnabled=true" },
  { phrase: "actualdryrunrunnerinvocationenabled=true", label: "actualDryRunRunnerInvocationEnabled=true" },
  { phrase: "actualdryrunrunnerexecutionenabled=true", label: "actualDryRunRunnerExecutionEnabled=true" },
];

function collectBlob(
  summary: RuntimeRunnerNoopHarnessSummary,
  envelope: RuntimeRunnerNoopInvocationEnvelope,
  result: RuntimeRunnerNoopResultMetadata,
  guard: RuntimeRunnerNoopHarnessSafetyGuard
): string {
  const parts: string[] = [
    summary.rationaleKo,
    ...summary.harnessBlockers,
    ...summary.recommendations,
    ...envelope.envelopeRows,
    ...envelope.recommendations,
    ...result.resultRows,
    ...guard.guardRows,
  ];
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function detectRuntimeRunnerNoopHarnessBoundaryViolations(input: {
  readonly summary: RuntimeRunnerNoopHarnessSummary;
  readonly envelope: RuntimeRunnerNoopInvocationEnvelope;
  readonly result: RuntimeRunnerNoopResultMetadata;
  readonly safetyGuard: RuntimeRunnerNoopHarnessSafetyGuard;
}): RuntimeRunnerNoopHarnessBoundaryViolationReport {
  const { summary, envelope, result, safetyGuard } = input;
  const actualFlagViolations: string[] = [];
  const wordingRiskFindings: string[] = [];

  if (summary.actualIsolatedRunnerInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeRunnerNoopHarnessSummary.actualIsolatedRunnerInvocationEnabled must be false"
    );
  }
  if (summary.actualIsolatedRunnerExecutionEnabled !== false) {
    actualFlagViolations.push(
      "runtimeRunnerNoopHarnessSummary.actualIsolatedRunnerExecutionEnabled must be false"
    );
  }
  if (summary.actualDryRunRunnerInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeRunnerNoopHarnessSummary.actualDryRunRunnerInvocationEnabled must be false"
    );
  }
  if (summary.actualDryRunRunnerExecutionEnabled !== false) {
    actualFlagViolations.push(
      "runtimeRunnerNoopHarnessSummary.actualDryRunRunnerExecutionEnabled must be false"
    );
  }
  if (summary.actualRuntimeAdapterInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeRunnerNoopHarnessSummary.actualRuntimeAdapterInvocationEnabled must be false"
    );
  }
  if (summary.actualExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeRunnerNoopHarnessSummary.actualExecutionEnabled must be false");
  }
  if (summary.actualProviderRoutingEnabled !== false) {
    actualFlagViolations.push("runtimeRunnerNoopHarnessSummary.actualProviderRoutingEnabled must be false");
  }
  if (summary.actualQueueControlEnabled !== false) {
    actualFlagViolations.push("runtimeRunnerNoopHarnessSummary.actualQueueControlEnabled must be false");
  }
  if (summary.actualRollbackExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeRunnerNoopHarnessSummary.actualRollbackExecutionEnabled must be false");
  }
  if (result.isolatedRunnerInvoked !== false) {
    actualFlagViolations.push("runtimeRunnerNoopResultMetadata.isolatedRunnerInvoked must be false");
  }
  if (result.isolatedRunnerExecuted !== false) {
    actualFlagViolations.push("runtimeRunnerNoopResultMetadata.isolatedRunnerExecuted must be false");
  }
  if (result.dryRunRunnerInvoked !== false) {
    actualFlagViolations.push("runtimeRunnerNoopResultMetadata.dryRunRunnerInvoked must be false");
  }
  if (result.dryRunRunnerExecuted !== false) {
    actualFlagViolations.push("runtimeRunnerNoopResultMetadata.dryRunRunnerExecuted must be false");
  }
  if (result.runtimeAdapterInvoked !== false) {
    actualFlagViolations.push("runtimeRunnerNoopResultMetadata.runtimeAdapterInvoked must be false");
  }
  if (result.executionPerformed !== false) {
    actualFlagViolations.push("runtimeRunnerNoopResultMetadata.executionPerformed must be false");
  }
  if (result.providerRoutingPerformed !== false) {
    actualFlagViolations.push("runtimeRunnerNoopResultMetadata.providerRoutingPerformed must be false");
  }
  if (result.queueControlPerformed !== false) {
    actualFlagViolations.push("runtimeRunnerNoopResultMetadata.queueControlPerformed must be false");
  }
  if (result.rollbackPerformed !== false) {
    actualFlagViolations.push("runtimeRunnerNoopResultMetadata.rollbackPerformed must be false");
  }
  if (result.promptMutated !== false) {
    actualFlagViolations.push("runtimeRunnerNoopResultMetadata.promptMutated must be false");
  }
  if (result.diagnosticOnly !== true) {
    actualFlagViolations.push("runtimeRunnerNoopResultMetadata.diagnosticOnly must be true");
  }
  if (safetyGuard.actualInvocationForbidden !== true) {
    actualFlagViolations.push("runtimeRunnerNoopHarnessSafetyGuard.actualInvocationForbidden must be true");
  }

  const blob = collectBlob(summary, envelope, result, safetyGuard);
  for (const { phrase, label } of RISK_PHRASES) {
    if (blob.includes(phrase)) {
      wordingRiskFindings.push(`wording/flag risk: ${label}`);
    }
  }

  const recommendations = mergeSortedUniqueKo([
    ...(actualFlagViolations.length > 0 || wordingRiskFindings.length > 0
      ? ["H30: no-op harness boundary violation — actual invocation·execution 플래그·문구 제거"]
      : []),
  ]);

  return {
    mode: "runtime_runner_noop_harness_boundary_violation_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualFlagViolations: mergeSortedUniqueKo(actualFlagViolations),
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations,
  };
}
