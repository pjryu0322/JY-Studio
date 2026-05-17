/**
 * H37.5 — governance boundary **boundary violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeExecutionGovernanceBoundaryPolicy,
  RuntimeExecutionGovernanceBoundarySummary,
  RuntimeExecutionGovernanceBoundaryViolationReport,
} from "./runtimeExecutionGovernanceBoundaryTypes";

const RISK_PHRASES: readonly { readonly phrase: string; readonly label: string }[] = [
  { phrase: "actualexecutionenabled=true", label: "actualExecutionEnabled=true" },
  { phrase: "actualexecutionroutingenabled=true", label: "actualExecutionRoutingEnabled=true" },
  { phrase: "actualexecutionroutingforbidden=false", label: "actualExecutionRoutingForbidden=false" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "executionrouting=true", label: "executionRouting=true" },
  { phrase: "releaseenforced=true", label: "releaseEnforced=true" },
  { phrase: "approvalenforced=true", label: "approvalEnforced=true" },
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
  { phrase: "actualapprovalenforcementenabled=true", label: "actualApprovalEnforcementEnabled=true" },
  { phrase: "actualapprovalenforcementforbidden=false", label: "actualApprovalEnforcementForbidden=false" },
];

function collectBlob(
  summary: RuntimeExecutionGovernanceBoundarySummary,
  policy: RuntimeExecutionGovernanceBoundaryPolicy
): string {
  return [
    summary.rationaleKo,
    ...summary.governanceBlockers,
    ...summary.recommendations,
    ...policy.recommendations,
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function detectRuntimeExecutionGovernanceBoundaryViolations(input: {
  readonly summary: RuntimeExecutionGovernanceBoundarySummary;
  readonly policy: RuntimeExecutionGovernanceBoundaryPolicy;
}): RuntimeExecutionGovernanceBoundaryViolationReport {
  const { summary, policy } = input;
  const actualFlagViolations: string[] = [];

  if (summary.actualExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeExecutionGovernanceBoundarySummary.actualExecutionEnabled must be false");
  }
  if (summary.actualExecutionRoutingEnabled !== false) {
    actualFlagViolations.push(
      "runtimeExecutionGovernanceBoundarySummary.actualExecutionRoutingEnabled must be false"
    );
  }
  if (summary.actualReleaseEnforcementEnabled !== false) {
    actualFlagViolations.push(
      "runtimeExecutionGovernanceBoundarySummary.actualReleaseEnforcementEnabled must be false"
    );
  }
  if (summary.actualNoopShellExecutionEnabled !== false) {
    actualFlagViolations.push(
      "runtimeExecutionGovernanceBoundarySummary.actualNoopShellExecutionEnabled must be false"
    );
  }
  if (summary.actualExecutionShellExecutionEnabled !== false) {
    actualFlagViolations.push(
      "runtimeExecutionGovernanceBoundarySummary.actualExecutionShellExecutionEnabled must be false"
    );
  }
  if (summary.actualRuntimeAdapterInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeExecutionGovernanceBoundarySummary.actualRuntimeAdapterInvocationEnabled must be false"
    );
  }
  if (summary.actualProviderRoutingEnabled !== false) {
    actualFlagViolations.push(
      "runtimeExecutionGovernanceBoundarySummary.actualProviderRoutingEnabled must be false"
    );
  }
  if (summary.actualQueueControlEnabled !== false) {
    actualFlagViolations.push("runtimeExecutionGovernanceBoundarySummary.actualQueueControlEnabled must be false");
  }
  if (summary.actualRollbackExecutionEnabled !== false) {
    actualFlagViolations.push(
      "runtimeExecutionGovernanceBoundarySummary.actualRollbackExecutionEnabled must be false"
    );
  }
  if (summary.actualApprovalEnforcementEnabled !== false) {
    actualFlagViolations.push(
      "runtimeExecutionGovernanceBoundarySummary.actualApprovalEnforcementEnabled must be false"
    );
  }
  if (policy.actualExecutionForbidden !== true) {
    actualFlagViolations.push("runtimeExecutionGovernanceBoundaryPolicy.actualExecutionForbidden must be true");
  }
  if (policy.actualExecutionRoutingForbidden !== true) {
    actualFlagViolations.push(
      "runtimeExecutionGovernanceBoundaryPolicy.actualExecutionRoutingForbidden must be true"
    );
  }
  if (policy.actualReleaseEnforcementForbidden !== true) {
    actualFlagViolations.push(
      "runtimeExecutionGovernanceBoundaryPolicy.actualReleaseEnforcementForbidden must be true"
    );
  }
  if (policy.actualShellExecutionForbidden !== true) {
    actualFlagViolations.push("runtimeExecutionGovernanceBoundaryPolicy.actualShellExecutionForbidden must be true");
  }
  if (policy.actualAdapterInvocationForbidden !== true) {
    actualFlagViolations.push(
      "runtimeExecutionGovernanceBoundaryPolicy.actualAdapterInvocationForbidden must be true"
    );
  }
  if (policy.actualProviderRoutingForbidden !== true) {
    actualFlagViolations.push(
      "runtimeExecutionGovernanceBoundaryPolicy.actualProviderRoutingForbidden must be true"
    );
  }
  if (policy.actualQueueControlForbidden !== true) {
    actualFlagViolations.push("runtimeExecutionGovernanceBoundaryPolicy.actualQueueControlForbidden must be true");
  }
  if (policy.actualRollbackForbidden !== true) {
    actualFlagViolations.push("runtimeExecutionGovernanceBoundaryPolicy.actualRollbackForbidden must be true");
  }
  if (policy.actualApprovalEnforcementForbidden !== true) {
    actualFlagViolations.push(
      "runtimeExecutionGovernanceBoundaryPolicy.actualApprovalEnforcementForbidden must be true"
    );
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
      ? ["H37.5: governance boundary violation — actual·routing·approval forbidden 플래그·문구 제거"]
      : []),
  ]);

  return {
    mode: "runtime_execution_governance_boundary_violation_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualExecutionRoutingEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    actualApprovalEnforcementEnabled: false,
    actualFlagViolations: mergeSortedUniqueKo(actualFlagViolations),
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations,
  };
}
