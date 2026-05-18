/**
 * H21 — resource governance 진단 묶음 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeResourceControlBoundary,
  RuntimeResourceGovernanceSummary,
  RuntimeResourcePolicyFinding,
} from "./runtimeResourceGovernanceTypes";

function serializeSummary(summary: RuntimeResourceGovernanceSummary): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    governanceMode: summary.governanceMode,
    governanceRisk: summary.governanceRisk,
    operatorReviewRequirement: summary.operatorReviewRequirement,
    allocationReadiness: summary.allocationReadiness,
    policyViolationCandidate: { ...summary.policyViolationCandidate },
    policyFindings: [...summary.policyFindings],
    recommendations: [...summary.recommendations],
  };
}

function serializeFindings(findings: readonly RuntimeResourcePolicyFinding[]): readonly Record<string, unknown>[] {
  return findings.map((f) => ({ ...f }));
}

function serializeBoundary(boundary: RuntimeResourceControlBoundary): Readonly<Record<string, unknown>> {
  return {
    mode: boundary.mode,
    actualRuntimeOrchestrationEnabled: boundary.actualRuntimeOrchestrationEnabled,
    boundary: boundary.boundary,
    rationaleKo: boundary.rationaleKo,
  };
}

export function serializeRuntimeResourceGovernanceDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeResourceGovernanceSummary: ReturnType<typeof serializeSummary>;
  runtimeResourcePolicyFindings: ReturnType<typeof serializeFindings>;
  runtimeResourceControlBoundary: ReturnType<typeof serializeBoundary>;
}> {
  return {
    runtimeResourceGovernanceSummary: serializeSummary(reports.runtimeResourceGovernanceSummary),
    runtimeResourcePolicyFindings: serializeFindings(reports.runtimeResourcePolicyFindings),
    runtimeResourceControlBoundary: serializeBoundary(reports.runtimeResourceControlBoundary),
  };
}
