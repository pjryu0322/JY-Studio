/**
 * H38.5 — governance release-readiness **violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { isRuntimeExecutionGovernanceForbiddenProofComplete } from "./buildRuntimeExecutionGovernanceForbiddenProof";
import type {
  RuntimeExecutionGovernanceForbiddenProof,
  RuntimeGovernanceNoEnforcementProof,
  RuntimeGovernanceReleaseReadinessSummary,
  RuntimeGovernanceReleaseReadinessViolationReport,
} from "./runtimeGovernanceReleaseReadinessTypes";

const RISK_PHRASES: readonly { readonly phrase: string; readonly label: string }[] = [
  { phrase: "actualexecutionenabled=true", label: "actualExecutionEnabled=true" },
  { phrase: "actualexecutionroutingenabled=true", label: "actualExecutionRoutingEnabled=true" },
  { phrase: "actualreleaseenforcementenabled=true", label: "actualReleaseEnforcementEnabled=true" },
  { phrase: "actualapprovalenforcementenabled=true", label: "actualApprovalEnforcementEnabled=true" },
  { phrase: "actualproviderroutingenabled=true", label: "actualProviderRoutingEnabled=true" },
  { phrase: "actualqueuecontrolenabled=true", label: "actualQueueControlEnabled=true" },
  { phrase: "actualrollbackexecutionenabled=true", label: "actualRollbackExecutionEnabled=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "executionroutingperformed=true", label: "executionRoutingPerformed=true" },
  { phrase: "releaseenforced=true", label: "releaseEnforced=true" },
  { phrase: "approvalenforced=true", label: "approvalEnforced=true" },
  { phrase: "providerroutingperformed=true", label: "providerRoutingPerformed=true" },
  { phrase: "queuecontrolperformed=true", label: "queueControlPerformed=true" },
  { phrase: "rollbackperformed=true", label: "rollbackPerformed=true" },
  { phrase: "executionblocked=true", label: "executionBlocked=true" },
  { phrase: "diagnosticonly=false", label: "diagnosticOnly=false" },
  { phrase: "actualexecutionforbidden=false", label: "actualExecutionForbidden=false" },
  { phrase: "actualapprovalenforcementforbidden=false", label: "actualApprovalEnforcementForbidden=false" },
];

function collectBlob(
  summary: RuntimeGovernanceReleaseReadinessSummary,
  noEnforcementProof: RuntimeGovernanceNoEnforcementProof,
  forbiddenProof: RuntimeExecutionGovernanceForbiddenProof
): string {
  return [
    summary.rationaleKo,
    ...summary.readinessBlockers,
    ...summary.recommendations,
    ...noEnforcementProof.proofRows,
    ...forbiddenProof.proofRows,
    ...noEnforcementProof.recommendations,
    ...forbiddenProof.recommendations,
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function detectRuntimeGovernanceReleaseReadinessViolations(input: {
  readonly summary: RuntimeGovernanceReleaseReadinessSummary;
  readonly noEnforcementProof: RuntimeGovernanceNoEnforcementProof;
  readonly forbiddenProof: RuntimeExecutionGovernanceForbiddenProof;
}): RuntimeGovernanceReleaseReadinessViolationReport {
  const { summary, noEnforcementProof, forbiddenProof } = input;
  const actualFlagViolations: string[] = [];
  const proofViolations: string[] = [];

  if (summary.actualExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeGovernanceReleaseReadinessSummary.actualExecutionEnabled must be false");
  }
  if (summary.actualExecutionRoutingEnabled !== false) {
    actualFlagViolations.push(
      "runtimeGovernanceReleaseReadinessSummary.actualExecutionRoutingEnabled must be false"
    );
  }
  if (summary.actualReleaseEnforcementEnabled !== false) {
    actualFlagViolations.push(
      "runtimeGovernanceReleaseReadinessSummary.actualReleaseEnforcementEnabled must be false"
    );
  }
  if (summary.actualApprovalEnforcementEnabled !== false) {
    actualFlagViolations.push(
      "runtimeGovernanceReleaseReadinessSummary.actualApprovalEnforcementEnabled must be false"
    );
  }
  if (summary.actualProviderRoutingEnabled !== false) {
    actualFlagViolations.push(
      "runtimeGovernanceReleaseReadinessSummary.actualProviderRoutingEnabled must be false"
    );
  }
  if (summary.actualQueueControlEnabled !== false) {
    actualFlagViolations.push("runtimeGovernanceReleaseReadinessSummary.actualQueueControlEnabled must be false");
  }
  if (summary.actualRollbackExecutionEnabled !== false) {
    actualFlagViolations.push(
      "runtimeGovernanceReleaseReadinessSummary.actualRollbackExecutionEnabled must be false"
    );
  }

  if (noEnforcementProof.executionPerformed !== false) {
    proofViolations.push("runtimeGovernanceNoEnforcementProof.executionPerformed must be false");
  }
  if (noEnforcementProof.executionRoutingPerformed !== false) {
    proofViolations.push("runtimeGovernanceNoEnforcementProof.executionRoutingPerformed must be false");
  }
  if (noEnforcementProof.releaseEnforced !== false) {
    proofViolations.push("runtimeGovernanceNoEnforcementProof.releaseEnforced must be false");
  }
  if (noEnforcementProof.approvalEnforced !== false) {
    proofViolations.push("runtimeGovernanceNoEnforcementProof.approvalEnforced must be false");
  }
  if (noEnforcementProof.providerRoutingPerformed !== false) {
    proofViolations.push("runtimeGovernanceNoEnforcementProof.providerRoutingPerformed must be false");
  }
  if (noEnforcementProof.queueControlPerformed !== false) {
    proofViolations.push("runtimeGovernanceNoEnforcementProof.queueControlPerformed must be false");
  }
  if (noEnforcementProof.rollbackPerformed !== false) {
    proofViolations.push("runtimeGovernanceNoEnforcementProof.rollbackPerformed must be false");
  }
  if (noEnforcementProof.executionBlocked !== false) {
    proofViolations.push("runtimeGovernanceNoEnforcementProof.executionBlocked must be false");
  }
  if (noEnforcementProof.diagnosticOnly !== true) {
    proofViolations.push("runtimeGovernanceNoEnforcementProof.diagnosticOnly must be true");
  }

  if (forbiddenProof.actualExecutionForbidden !== true) {
    proofViolations.push("runtimeExecutionGovernanceForbiddenProof.actualExecutionForbidden must be true");
  }
  if (forbiddenProof.actualExecutionRoutingForbidden !== true) {
    proofViolations.push("runtimeExecutionGovernanceForbiddenProof.actualExecutionRoutingForbidden must be true");
  }
  if (forbiddenProof.actualReleaseEnforcementForbidden !== true) {
    proofViolations.push("runtimeExecutionGovernanceForbiddenProof.actualReleaseEnforcementForbidden must be true");
  }
  if (forbiddenProof.actualApprovalEnforcementForbidden !== true) {
    proofViolations.push("runtimeExecutionGovernanceForbiddenProof.actualApprovalEnforcementForbidden must be true");
  }
  if (forbiddenProof.actualProviderRoutingForbidden !== true) {
    proofViolations.push("runtimeExecutionGovernanceForbiddenProof.actualProviderRoutingForbidden must be true");
  }
  if (forbiddenProof.actualQueueControlForbidden !== true) {
    proofViolations.push("runtimeExecutionGovernanceForbiddenProof.actualQueueControlForbidden must be true");
  }
  if (forbiddenProof.actualRollbackForbidden !== true) {
    proofViolations.push("runtimeExecutionGovernanceForbiddenProof.actualRollbackForbidden must be true");
  }
  if (forbiddenProof.actualExecutionBlockingForbidden !== true) {
    proofViolations.push("runtimeExecutionGovernanceForbiddenProof.actualExecutionBlockingForbidden must be true");
  }
  if (!isRuntimeExecutionGovernanceForbiddenProofComplete(forbiddenProof)) {
    proofViolations.push("runtimeExecutionGovernanceForbiddenProof incomplete");
  }

  const wordingRiskFindings: string[] = [];
  const blob = collectBlob(summary, noEnforcementProof, forbiddenProof);
  for (const { phrase, label } of RISK_PHRASES) {
    if (blob.includes(phrase)) {
      wordingRiskFindings.push(`wording/flag risk: ${label}`);
    }
  }

  const recommendations = mergeSortedUniqueKo([
    ...(actualFlagViolations.length > 0 || proofViolations.length > 0 || wordingRiskFindings.length > 0
      ? ["H38.5: governance release-readiness violation — actual·proof·enforcement 플래그·문구 제거"]
      : []),
  ]);

  return {
    mode: "runtime_governance_release_readiness_violation_report",
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
    proofViolations: mergeSortedUniqueKo(proofViolations),
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations,
  };
}
