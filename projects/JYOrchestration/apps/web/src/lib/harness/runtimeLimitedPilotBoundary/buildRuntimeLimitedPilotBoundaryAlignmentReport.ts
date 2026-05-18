/**
 * H42.5 — limited pilot boundary **alignment report**(read-only; H43 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  LIMITED_PILOT_ALIGNMENT_CHECKLIST_LABEL_ROWS,
  LIMITED_PILOT_BOUNDARY_SCOPE_SOURCE_LAYER,
  LIMITED_PILOT_BOUNDARY_SCOPE_TARGET_LAYER,
  RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
} from "./runtimeLimitedPilotBoundaryConstants";
import {
  limitedPilotForbiddenIncludes,
  pilotBoundaryBlockersAligned,
  readLimitedPilotBoundaryUpstreamContext,
  resolveLimitedPilotBoundaryAlignmentStatus,
  runtimeChecklistHasLabel,
} from "./runtimeLimitedPilotBoundaryCheckHelpers";
import type {
  RuntimeLimitedPilotBoundaryAlignmentReport,
  RuntimeLimitedPilotBoundaryBlockerReport,
  RuntimeLimitedPilotBoundaryPolicy,
  RuntimeLimitedPilotBoundaryScope,
  RuntimeLimitedPilotBoundarySummary,
  RuntimeLimitedPilotBoundaryViolationReport,
  RuntimeLimitedPilotInputContract,
  RuntimeLimitedPilotOutputContract,
  RuntimeLimitedPilotReadinessChecklist,
} from "./runtimeLimitedPilotBoundaryTypes";

export function buildRuntimeLimitedPilotBoundaryAlignmentReport(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary;
  readonly summary: RuntimeLimitedPilotBoundarySummary;
  readonly scope: RuntimeLimitedPilotBoundaryScope;
  readonly policy: RuntimeLimitedPilotBoundaryPolicy;
  readonly inputContract: RuntimeLimitedPilotInputContract;
  readonly outputContract: RuntimeLimitedPilotOutputContract;
  readonly checklist: RuntimeLimitedPilotReadinessChecklist;
  readonly blockerReport: RuntimeLimitedPilotBoundaryBlockerReport;
  readonly boundaryViolation: RuntimeLimitedPilotBoundaryViolationReport;
}): RuntimeLimitedPilotBoundaryAlignmentReport {
  const {
    reports,
    summary,
    scope,
    policy,
    inputContract,
    outputContract,
    checklist,
    blockerReport,
    boundaryViolation,
  } = input;
  const upstream = readLimitedPilotBoundaryUpstreamContext(reports);
  const findings: string[] = [];

  if (
    summary.candidateStatus === "limited_pilot_boundary_metadata_candidate" &&
    upstream.activationFinalGate.finalGateStatus !== "ready_metadata"
  ) {
    findings.push("controlled activation final safety gate misaligned with limited pilot boundary summary");
  }
  if (scope.candidateSourceLayer !== LIMITED_PILOT_BOUNDARY_SCOPE_SOURCE_LAYER) {
    findings.push(`scope.candidateSourceLayer must be ${LIMITED_PILOT_BOUNDARY_SCOPE_SOURCE_LAYER}`);
  }
  if (scope.candidateTargetLayer !== LIMITED_PILOT_BOUNDARY_SCOPE_TARGET_LAYER) {
    findings.push(`scope.candidateTargetLayer must be ${LIMITED_PILOT_BOUNDARY_SCOPE_TARGET_LAYER}`);
  }
  if (!limitedPilotForbiddenIncludes(scope.forbiddenPilotBoundaryOperations, "actual pilot activation")) {
    findings.push("forbiddenPilotBoundaryOperations missing actual pilot activation");
  }
  if (!limitedPilotForbiddenIncludes(scope.forbiddenPilotBoundaryOperations, "actual pilot execution")) {
    findings.push("forbiddenPilotBoundaryOperations missing actual pilot execution");
  }
  if (!limitedPilotForbiddenIncludes(scope.forbiddenPilotBoundaryOperations, "actual sandbox invocation")) {
    findings.push("forbiddenPilotBoundaryOperations missing actual sandbox invocation");
  }
  if (policy.pilotBoundaryAllowedMode !== summary.pilotBoundaryMode) {
    findings.push("policy.pilotBoundaryAllowedMode misaligned with summary.pilotBoundaryMode");
  }
  if (policy.actualPilotActivationForbidden !== true) {
    findings.push("policy.actualPilotActivationForbidden must be true");
  }
  if (policy.actualSandboxInvocationForbidden !== true) {
    findings.push("policy.actualSandboxInvocationForbidden must be true");
  }
  if (
    !inputContract.contractRows.some((r) =>
      r.includes("runtimeControlledActivationCandidateFinalSafetyGate")
    )
  ) {
    findings.push("input contract misaligned with controlled activation final safety gate");
  }
  if (
    !outputContract.contractRows.some((r) => r.includes("pilotBoundaryReadinessMetadata"))
  ) {
    findings.push("output contract misaligned with pilot boundary readiness metadata");
  }
  for (const label of LIMITED_PILOT_ALIGNMENT_CHECKLIST_LABEL_ROWS) {
    if (!runtimeChecklistHasLabel(checklist.checklist, label)) {
      findings.push(`checklist missing ${label}`);
    }
  }
  if (!pilotBoundaryBlockersAligned(blockerReport.blockers, summary.pilotBoundaryBlockers)) {
    findings.push("blocker report misaligned with summary.pilotBoundaryBlockers");
  }
  if (
    summary.candidateStatus === "limited_pilot_boundary_metadata_candidate" &&
    (boundaryViolation.actualFlagViolations.length > 0 ||
      boundaryViolation.policyViolations.length > 0 ||
      boundaryViolation.wordingRiskFindings.length > 0)
  ) {
    findings.push("limited_pilot_boundary_metadata_candidate requires empty limited pilot boundary violations");
  }
  if (
    summary.candidateStatus === "limited_pilot_boundary_metadata_candidate" &&
    (upstream.activationViolation.actualFlagViolations.length > 0 ||
      upstream.activationViolation.policyViolations.length > 0)
  ) {
    findings.push("upstream controlled activation violations misaligned with limited pilot boundary candidate");
  }

  const alignmentStatus = resolveLimitedPilotBoundaryAlignmentStatus(findings);

  return {
    mode: "runtime_limited_pilot_boundary_alignment_report",
    ...RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
    alignmentStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations: mergeSortedUniqueKo([
      ...(alignmentStatus === "aligned_metadata"
        ? ["H42.5: limited pilot boundary aligned_metadata — H43 entry 후보(pilot activation 없음)"]
        : []),
      ...(alignmentStatus === "partial"
        ? ["H42.5: limited pilot boundary partial alignment — controlled activation gate·contracts 재검토"]
        : []),
      ...(alignmentStatus === "failed"
        ? ["H42.5: limited pilot boundary alignment failed — policy·forbidden ops·checklist 정렬"]
        : []),
    ]),
  };
}
