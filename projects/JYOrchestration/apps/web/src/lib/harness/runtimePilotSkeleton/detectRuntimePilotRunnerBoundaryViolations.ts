/**
 * H28.5 — runner skeleton·contract·guard **boundary violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeDryRunRunnerContract,
  RuntimePilotRunnerBoundaryViolationReport,
  RuntimePilotRunnerInputEnvelope,
  RuntimePilotRunnerNoExecutionResultMetadata,
  RuntimePilotRunnerOutputEnvelope,
  RuntimePilotRunnerSafetyGuard,
  RuntimePilotSkeletonSummary,
} from "./runtimePilotSkeletonTypes";

const RISK_PHRASES: readonly { readonly phrase: string; readonly label: string }[] = [
  { phrase: "runnerexecuted=true", label: "runnerExecuted=true" },
  { phrase: "dryrunrunnerexecuted=true", label: "dryRunRunnerExecuted=true" },
  { phrase: "adapterinvoked=true", label: "adapterInvoked=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "providerroutingperformed=true", label: "providerRoutingPerformed=true" },
  { phrase: "queuecontrolperformed=true", label: "queueControlPerformed=true" },
  { phrase: "rollbackperformed=true", label: "rollbackPerformed=true" },
  { phrase: "actualisolatedrunnerexecutionenabled=true", label: "actualIsolatedRunnerExecutionEnabled=true" },
  { phrase: "actualdryrunrunnerexecutionenabled=true", label: "actualDryRunRunnerExecutionEnabled=true" },
  { phrase: "actualpilotexecutionenabled=true", label: "actualPilotExecutionEnabled=true" },
  { phrase: "actualruntimeadapterinvocationenabled=true", label: "actualRuntimeAdapterInvocationEnabled=true" },
  { phrase: "actualexecutionenabled=true", label: "actualExecutionEnabled=true" },
  { phrase: "actualproviderroutingenabled=true", label: "actualProviderRoutingEnabled=true" },
  { phrase: "actualqueuecontrolenabled=true", label: "actualQueueControlEnabled=true" },
  { phrase: "actualrollbackexecutionenabled=true", label: "actualRollbackExecutionEnabled=true" },
];

function collectBlob(
  summary: RuntimePilotSkeletonSummary,
  contract: RuntimeDryRunRunnerContract,
  inputEnvelope: RuntimePilotRunnerInputEnvelope,
  outputEnvelope: RuntimePilotRunnerOutputEnvelope,
  safetyGuard: RuntimePilotRunnerSafetyGuard,
  noExecution: RuntimePilotRunnerNoExecutionResultMetadata
): string {
  const parts: string[] = [
    summary.rationaleKo,
    ...summary.skeletonBlockers,
    ...summary.recommendations,
    ...contract.forbiddenRunnerOperations,
    ...contract.runnerNoExecutionGuarantees,
    ...contract.recommendations,
    ...inputEnvelope.envelopeRows,
    ...outputEnvelope.acceptedMetadataRows,
    ...outputEnvelope.rejectedMetadataRows,
    ...outputEnvelope.safetyEnvelopeRows,
    ...safetyGuard.guardRows,
    ...noExecution.resultRows,
  ];
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function detectRuntimePilotRunnerBoundaryViolations(input: {
  readonly summary: RuntimePilotSkeletonSummary;
  readonly contract: RuntimeDryRunRunnerContract;
  readonly inputEnvelope: RuntimePilotRunnerInputEnvelope;
  readonly outputEnvelope: RuntimePilotRunnerOutputEnvelope;
  readonly safetyGuard: RuntimePilotRunnerSafetyGuard;
  readonly noExecution: RuntimePilotRunnerNoExecutionResultMetadata;
}): RuntimePilotRunnerBoundaryViolationReport {
  const { summary, contract, inputEnvelope, outputEnvelope, safetyGuard, noExecution } = input;
  const actualFlagViolations: string[] = [];
  const wordingRiskFindings: string[] = [];

  if (summary.actualIsolatedRunnerExecutionEnabled !== false) {
    actualFlagViolations.push("runtimePilotSkeletonSummary.actualIsolatedRunnerExecutionEnabled must be false");
  }
  if (summary.actualDryRunRunnerExecutionEnabled !== false) {
    actualFlagViolations.push("runtimePilotSkeletonSummary.actualDryRunRunnerExecutionEnabled must be false");
  }
  if (summary.actualPilotExecutionEnabled !== false) {
    actualFlagViolations.push("runtimePilotSkeletonSummary.actualPilotExecutionEnabled must be false");
  }
  if (summary.actualRuntimeAdapterInvocationEnabled !== false) {
    actualFlagViolations.push("runtimePilotSkeletonSummary.actualRuntimeAdapterInvocationEnabled must be false");
  }
  if (summary.actualExecutionEnabled !== false) {
    actualFlagViolations.push("runtimePilotSkeletonSummary.actualExecutionEnabled must be false");
  }
  if (summary.actualProviderRoutingEnabled !== false) {
    actualFlagViolations.push("runtimePilotSkeletonSummary.actualProviderRoutingEnabled must be false");
  }
  if (summary.actualQueueControlEnabled !== false) {
    actualFlagViolations.push("runtimePilotSkeletonSummary.actualQueueControlEnabled must be false");
  }
  if (summary.actualRollbackExecutionEnabled !== false) {
    actualFlagViolations.push("runtimePilotSkeletonSummary.actualRollbackExecutionEnabled must be false");
  }
  if (contract.actualIsolatedRunnerExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeDryRunRunnerContract.actualIsolatedRunnerExecutionEnabled must be false");
  }
  if (contract.actualDryRunRunnerExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeDryRunRunnerContract.actualDryRunRunnerExecutionEnabled must be false");
  }
  if (safetyGuard.actualExecutionForbidden !== true) {
    actualFlagViolations.push("runtimePilotRunnerSafetyGuard.actualExecutionForbidden must be true");
  }
  if (safetyGuard.actualAdapterInvocationForbidden !== true) {
    actualFlagViolations.push("runtimePilotRunnerSafetyGuard.actualAdapterInvocationForbidden must be true");
  }
  if (safetyGuard.actualProviderRoutingForbidden !== true) {
    actualFlagViolations.push("runtimePilotRunnerSafetyGuard.actualProviderRoutingForbidden must be true");
  }
  if (safetyGuard.actualQueueControlForbidden !== true) {
    actualFlagViolations.push("runtimePilotRunnerSafetyGuard.actualQueueControlForbidden must be true");
  }
  if (safetyGuard.actualRollbackForbidden !== true) {
    actualFlagViolations.push("runtimePilotRunnerSafetyGuard.actualRollbackForbidden must be true");
  }
  if (safetyGuard.actualPromptMutationForbidden !== true) {
    actualFlagViolations.push("runtimePilotRunnerSafetyGuard.actualPromptMutationForbidden must be true");
  }
  if (noExecution.runnerExecuted !== false) {
    actualFlagViolations.push("runtimePilotRunnerNoExecutionResultMetadata.runnerExecuted must be false");
  }
  if (noExecution.dryRunRunnerExecuted !== false) {
    actualFlagViolations.push("runtimePilotRunnerNoExecutionResultMetadata.dryRunRunnerExecuted must be false");
  }
  if (noExecution.adapterInvoked !== false) {
    actualFlagViolations.push("runtimePilotRunnerNoExecutionResultMetadata.adapterInvoked must be false");
  }
  if (noExecution.executionPerformed !== false) {
    actualFlagViolations.push("runtimePilotRunnerNoExecutionResultMetadata.executionPerformed must be false");
  }
  if (noExecution.providerRoutingPerformed !== false) {
    actualFlagViolations.push("runtimePilotRunnerNoExecutionResultMetadata.providerRoutingPerformed must be false");
  }
  if (noExecution.queueControlPerformed !== false) {
    actualFlagViolations.push("runtimePilotRunnerNoExecutionResultMetadata.queueControlPerformed must be false");
  }
  if (noExecution.rollbackPerformed !== false) {
    actualFlagViolations.push("runtimePilotRunnerNoExecutionResultMetadata.rollbackPerformed must be false");
  }
  if (noExecution.diagnosticOnly !== true) {
    actualFlagViolations.push("runtimePilotRunnerNoExecutionResultMetadata.diagnosticOnly must be true");
  }

  const blob = collectBlob(summary, contract, inputEnvelope, outputEnvelope, safetyGuard, noExecution);
  for (const { phrase, label } of RISK_PHRASES) {
    if (blob.includes(phrase)) {
      wordingRiskFindings.push(`wording/flag risk: ${label}`);
    }
  }

  const recommendations = mergeSortedUniqueKo([
    ...(actualFlagViolations.length > 0 || wordingRiskFindings.length > 0
      ? ["H28.5: runner boundary violation — actual runner·execution 플래그·문구 제거"]
      : []),
  ]);

  return {
    mode: "runtime_pilot_runner_boundary_violation_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualFlagViolations: mergeSortedUniqueKo(actualFlagViolations),
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations,
  };
}
