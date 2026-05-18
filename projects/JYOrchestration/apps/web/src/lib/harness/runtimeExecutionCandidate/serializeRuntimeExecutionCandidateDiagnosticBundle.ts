/**
 * H23 — execution candidate 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeExecutionCandidateBlockersReport,
  RuntimeExecutionCandidatePreconditions,
  RuntimeExecutionCandidateScope,
  RuntimeExecutionCandidateSummary,
} from "./runtimeExecutionCandidateTypes";

function serializeSummary(s: RuntimeExecutionCandidateSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualExecutionEnabled: s.actualExecutionEnabled,
    candidateStatus: s.candidateStatus,
    candidateRisk: s.candidateRisk,
    rationaleKo: s.rationaleKo,
    candidatePreconditions: [...s.candidatePreconditions].sort((a, b) => a.localeCompare(b, "ko")),
    candidateBlockers: [...s.candidateBlockers].sort((a, b) => a.localeCompare(b, "ko")),
    requiredApprovals: [...s.requiredApprovals].sort((a, b) => a.localeCompare(b, "ko")),
    rollbackPrerequisites: [...s.rollbackPrerequisites].sort((a, b) => a.localeCompare(b, "ko")),
    recommendations: [...s.recommendations].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

function serializeScope(s: RuntimeExecutionCandidateScope): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualExecutionEnabled: s.actualExecutionEnabled,
    sourceLayer: s.sourceLayer,
    targetLayer: s.targetLayer,
    candidateInputs: [...s.candidateInputs].sort((a, b) => a.localeCompare(b, "ko")),
    candidateOutputs: [...s.candidateOutputs].sort((a, b) => a.localeCompare(b, "ko")),
    allowedMetadataScopes: [...s.allowedMetadataScopes].sort((a, b) => a.localeCompare(b, "ko")),
    forbiddenExecutionScopes: [...s.forbiddenExecutionScopes].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

function serializePre(p: RuntimeExecutionCandidatePreconditions): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    actualRuntimeOrchestrationEnabled: p.actualRuntimeOrchestrationEnabled,
    actualExecutionEnabled: p.actualExecutionEnabled,
    preconditions: [...p.preconditions].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

function serializeBlockers(b: RuntimeExecutionCandidateBlockersReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualExecutionEnabled: b.actualExecutionEnabled,
    blockers: [...b.blockers].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

export function serializeRuntimeExecutionCandidateDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeExecutionCandidateSummary: ReturnType<typeof serializeSummary>;
  runtimeExecutionCandidateScope: ReturnType<typeof serializeScope>;
  runtimeExecutionCandidatePreconditions: ReturnType<typeof serializePre>;
  runtimeExecutionCandidateBlockers: ReturnType<typeof serializeBlockers>;
}> {
  return {
    runtimeExecutionCandidateSummary: serializeSummary(reports.runtimeExecutionCandidateSummary),
    runtimeExecutionCandidateScope: serializeScope(reports.runtimeExecutionCandidateScope),
    runtimeExecutionCandidatePreconditions: serializePre(reports.runtimeExecutionCandidatePreconditions),
    runtimeExecutionCandidateBlockers: serializeBlockers(reports.runtimeExecutionCandidateBlockers),
  };
}
