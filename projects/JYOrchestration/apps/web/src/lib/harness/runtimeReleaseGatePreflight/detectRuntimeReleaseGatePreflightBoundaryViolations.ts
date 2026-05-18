/**
 * H35.5 — release-gate preflight **boundary violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeReleaseGateNoExecutionProof,
  RuntimeReleaseGateOperationForbiddenProof,
  RuntimeReleaseGatePreflightBoundaryViolationReport,
  RuntimeReleaseGatePreflightSummary,
} from "./runtimeReleaseGatePreflightTypes";

const RISK_PHRASES: readonly { readonly phrase: string; readonly label: string }[] = [
  { phrase: "releaseenforced=true", label: "releaseEnforced=true" },
  { phrase: "noopshellexecuted=true", label: "noopShellExecuted=true" },
  { phrase: "executionshellexecuted=true", label: "executionShellExecuted=true" },
  { phrase: "runtimeadapterinvoked=true", label: "runtimeAdapterInvoked=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "providerroutingperformed=true", label: "providerRoutingPerformed=true" },
  { phrase: "queuecontrolperformed=true", label: "queueControlPerformed=true" },
  { phrase: "rollbackperformed=true", label: "rollbackPerformed=true" },
  { phrase: "promptmutated=true", label: "promptMutated=true" },
  { phrase: "tokenenforced=true", label: "tokenEnforced=true" },
  { phrase: "contextpruned=true", label: "contextPruned=true" },
  { phrase: "mergeblocked=true", label: "mergeBlocked=true" },
  { phrase: "diagnosticonly=false", label: "diagnosticOnly=false" },
  { phrase: "actualreleaseenforcementenabled=true", label: "actualReleaseEnforcementEnabled=true" },
  { phrase: "actualnoopshellexecutionenabled=true", label: "actualNoopShellExecutionEnabled=true" },
  { phrase: "actualexecutionshellexecutionenabled=true", label: "actualExecutionShellExecutionEnabled=true" },
  { phrase: "actualruntimeadapterinvocationenabled=true", label: "actualRuntimeAdapterInvocationEnabled=true" },
  { phrase: "actualexecutionenabled=true", label: "actualExecutionEnabled=true" },
];

function collectBlob(
  summary: RuntimeReleaseGatePreflightSummary,
  noExecutionProof: RuntimeReleaseGateNoExecutionProof,
  operationForbiddenProof: RuntimeReleaseGateOperationForbiddenProof
): string {
  return [
    summary.rationaleKo,
    ...summary.preflightBlockers,
    ...summary.recommendations,
    ...noExecutionProof.proofRows,
    ...operationForbiddenProof.proofRows,
    ...noExecutionProof.recommendations,
    ...operationForbiddenProof.recommendations,
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function detectRuntimeReleaseGatePreflightBoundaryViolations(input: {
  readonly summary: RuntimeReleaseGatePreflightSummary;
  readonly noExecutionProof: RuntimeReleaseGateNoExecutionProof;
  readonly operationForbiddenProof: RuntimeReleaseGateOperationForbiddenProof;
}): RuntimeReleaseGatePreflightBoundaryViolationReport {
  const { summary, noExecutionProof, operationForbiddenProof } = input;
  const actualFlagViolations: string[] = [];
  const proofViolations: string[] = [];

  if (summary.actualReleaseEnforcementEnabled !== false) {
    actualFlagViolations.push("runtimeReleaseGatePreflightSummary.actualReleaseEnforcementEnabled must be false");
  }
  if (summary.actualNoopShellExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeReleaseGatePreflightSummary.actualNoopShellExecutionEnabled must be false");
  }
  if (summary.actualExecutionShellExecutionEnabled !== false) {
    actualFlagViolations.push(
      "runtimeReleaseGatePreflightSummary.actualExecutionShellExecutionEnabled must be false"
    );
  }
  if (summary.actualRuntimeAdapterInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeReleaseGatePreflightSummary.actualRuntimeAdapterInvocationEnabled must be false"
    );
  }
  if (summary.actualExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeReleaseGatePreflightSummary.actualExecutionEnabled must be false");
  }
  if (summary.actualProviderRoutingEnabled !== false) {
    actualFlagViolations.push("runtimeReleaseGatePreflightSummary.actualProviderRoutingEnabled must be false");
  }
  if (summary.actualQueueControlEnabled !== false) {
    actualFlagViolations.push("runtimeReleaseGatePreflightSummary.actualQueueControlEnabled must be false");
  }
  if (summary.actualRollbackExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeReleaseGatePreflightSummary.actualRollbackExecutionEnabled must be false");
  }

  if (noExecutionProof.releaseEnforced !== false) {
    proofViolations.push("runtimeReleaseGateNoExecutionProof.releaseEnforced must be false");
  }
  if (noExecutionProof.noopShellExecuted !== false) {
    proofViolations.push("runtimeReleaseGateNoExecutionProof.noopShellExecuted must be false");
  }
  if (noExecutionProof.executionShellExecuted !== false) {
    proofViolations.push("runtimeReleaseGateNoExecutionProof.executionShellExecuted must be false");
  }
  if (noExecutionProof.runtimeAdapterInvoked !== false) {
    proofViolations.push("runtimeReleaseGateNoExecutionProof.runtimeAdapterInvoked must be false");
  }
  if (noExecutionProof.executionPerformed !== false) {
    proofViolations.push("runtimeReleaseGateNoExecutionProof.executionPerformed must be false");
  }
  if (noExecutionProof.providerRoutingPerformed !== false) {
    proofViolations.push("runtimeReleaseGateNoExecutionProof.providerRoutingPerformed must be false");
  }
  if (noExecutionProof.queueControlPerformed !== false) {
    proofViolations.push("runtimeReleaseGateNoExecutionProof.queueControlPerformed must be false");
  }
  if (noExecutionProof.rollbackPerformed !== false) {
    proofViolations.push("runtimeReleaseGateNoExecutionProof.rollbackPerformed must be false");
  }
  if (noExecutionProof.promptMutated !== false) {
    proofViolations.push("runtimeReleaseGateNoExecutionProof.promptMutated must be false");
  }
  if (noExecutionProof.tokenEnforced !== false) {
    proofViolations.push("runtimeReleaseGateNoExecutionProof.tokenEnforced must be false");
  }
  if (noExecutionProof.contextPruned !== false) {
    proofViolations.push("runtimeReleaseGateNoExecutionProof.contextPruned must be false");
  }
  if (noExecutionProof.mergeBlocked !== false) {
    proofViolations.push("runtimeReleaseGateNoExecutionProof.mergeBlocked must be false");
  }
  if (noExecutionProof.diagnosticOnly !== true) {
    proofViolations.push("runtimeReleaseGateNoExecutionProof.diagnosticOnly must be true");
  }
  if (operationForbiddenProof.actualReleaseEnforcementForbidden !== true) {
    proofViolations.push("runtimeReleaseGateOperationForbiddenProof.actualReleaseEnforcementForbidden must be true");
  }
  if (operationForbiddenProof.actualShellExecutionForbidden !== true) {
    proofViolations.push("runtimeReleaseGateOperationForbiddenProof.actualShellExecutionForbidden must be true");
  }
  if (operationForbiddenProof.actualExecutionForbidden !== true) {
    proofViolations.push("runtimeReleaseGateOperationForbiddenProof.actualExecutionForbidden must be true");
  }

  const wordingRiskFindings: string[] = [];
  const blob = collectBlob(summary, noExecutionProof, operationForbiddenProof);
  for (const { phrase, label } of RISK_PHRASES) {
    if (blob.includes(phrase)) {
      wordingRiskFindings.push(`wording/flag risk: ${label}`);
    }
  }

  const recommendations = mergeSortedUniqueKo([
    ...(actualFlagViolations.length > 0 || proofViolations.length > 0 || wordingRiskFindings.length > 0
      ? ["H35.5: preflight boundary violation — actual·proof 플래그·문구 제거"]
      : []),
  ]);

  return {
    mode: "runtime_release_gate_preflight_boundary_violation_report",
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
    proofViolations: mergeSortedUniqueKo(proofViolations),
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations,
  };
}
