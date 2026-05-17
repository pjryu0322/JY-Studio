/**
 * H44 — pilot execution readiness proof·upstream 검증 헬퍼(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { readLimitedPilotReadinessUpstreamContext } from "@/lib/harness/runtimeLimitedPilotReadinessReview/runtimeLimitedPilotReadinessReviewCheckHelpers";
import {
  RUNTIME_FINAL_PILOT_EXECUTION_FORBIDDEN_PROOF_REQUIRED_KEYS,
  RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
} from "./runtimePilotExecutionReadinessConstants";
import type {
  RuntimeFinalPilotExecutionForbiddenProof,
  RuntimeFinalPilotNoExecutionProof,
} from "./runtimePilotExecutionReadinessTypes";

export function readPilotExecutionReadinessUpstreamContext(
  reports: RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness
) {
  return {
    ...readLimitedPilotReadinessUpstreamContext(reports),
    reviewFinalGate: reports.runtimeLimitedPilotReadinessReviewFinalSafetyGate,
    reviewSummary: reports.runtimeLimitedPilotReadinessReviewSummary,
    reviewVerification: reports.runtimeLimitedPilotReadinessReviewVerificationReport,
    reviewAlignment: reports.runtimeLimitedPilotReadinessReviewAlignmentReport,
    reviewViolation: reports.runtimeLimitedPilotReadinessReviewViolationReport,
    pilotContractBoundary: reports.runtimePilotContractHardeningBoundary,
    pilotNoExecutionProof: reports.runtimePilotNoExecutionProof,
    pilotForbiddenProof: reports.runtimePilotExecutionForbiddenProof,
    pilotReadinessBlockers: reports.runtimePilotReadinessBlockerReport,
  };
}

export function isRuntimeFinalPilotExecutionForbiddenProofComplete(
  proof: RuntimeFinalPilotExecutionForbiddenProof
): boolean {
  return RUNTIME_FINAL_PILOT_EXECUTION_FORBIDDEN_PROOF_REQUIRED_KEYS.every((key) => proof[key] === true);
}

export function isRuntimeFinalPilotNoExecutionProofValid(
  proof: Readonly<{ diagnosticOnly: boolean }>
): boolean {
  return proof.diagnosticOnly === true;
}

const FINAL_NO_EXECUTION_PROOF_FALSE_FIELDS: readonly {
  readonly key: keyof RuntimeFinalPilotNoExecutionProof;
  readonly label: string;
}[] = [
  { key: "pilotActivated", label: "pilotActivated" },
  { key: "pilotExecuted", label: "pilotExecuted" },
  { key: "isolatedRunnerInvoked", label: "isolatedRunnerInvoked" },
  { key: "isolatedRunnerExecuted", label: "isolatedRunnerExecuted" },
  { key: "dryRunRunnerInvoked", label: "dryRunRunnerInvoked" },
  { key: "dryRunRunnerExecuted", label: "dryRunRunnerExecuted" },
  { key: "runtimeAdapterInvoked", label: "runtimeAdapterInvoked" },
  { key: "sandboxInvoked", label: "sandboxInvoked" },
  { key: "executionPerformed", label: "executionPerformed" },
  { key: "executionRoutingPerformed", label: "executionRoutingPerformed" },
  { key: "releaseEnforced", label: "releaseEnforced" },
  { key: "approvalEnforced", label: "approvalEnforced" },
  { key: "executionBlocked", label: "executionBlocked" },
  { key: "mergeBlocked", label: "mergeBlocked" },
];

export function collectFinalPilotNoExecutionProofViolations(
  proof: RuntimeFinalPilotNoExecutionProof
): readonly string[] {
  const violations: string[] = [];
  for (const { key, label } of FINAL_NO_EXECUTION_PROOF_FALSE_FIELDS) {
    if (proof[key] !== false) {
      violations.push(`runtimeFinalPilotNoExecutionProof.${label} must be false`);
    }
  }
  if (proof.diagnosticOnly !== true) {
    violations.push("runtimeFinalPilotNoExecutionProof.diagnosticOnly must be true");
  }
  return violations;
}

export function collectFinalPilotForbiddenProofViolations(
  proof: RuntimeFinalPilotExecutionForbiddenProof
): readonly string[] {
  const violations: string[] = [];
  for (const key of RUNTIME_FINAL_PILOT_EXECUTION_FORBIDDEN_PROOF_REQUIRED_KEYS) {
    if (proof[key] !== true) {
      violations.push(`runtimeFinalPilotExecutionForbiddenProof.${key} must be true`);
    }
  }
  return violations;
}

export function collectPilotExecutionReadinessSummaryActualFlagViolations(
  summary: Readonly<Record<string, unknown>>
): readonly string[] {
  const violations: string[] = [];
  for (const [key, expected] of Object.entries(RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED)) {
    if (summary[key] !== expected) {
      violations.push(`runtimePilotExecutionReadinessSummary.${key} must be false`);
    }
  }
  return violations;
}
