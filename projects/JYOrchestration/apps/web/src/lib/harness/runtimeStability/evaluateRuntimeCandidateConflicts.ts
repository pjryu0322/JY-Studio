/**
 * H12 — enforcement **후보 간 충돌** planning 분석(read-only).
 */

import type { HarnessMaturityBaselineReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ControlledEnforcementGovernanceReport } from "@/lib/harness/enforcementGovernance/controlledEnforcementGovernanceTypes";
import type { GovernanceDependencyPlanningReport } from "@/lib/harness/enforcementGovernance/controlledEnforcementGovernanceTypes";
import { evaluateResourcePressure } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type {
  CandidateCapabilityPlanningReport,
  RuntimeEnforcementCandidateReport,
} from "@/lib/harness/runtimeEnforcement/runtimeEnforcementCandidateTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type {
  CandidateConflictSeverity,
  CandidateSaturationLevel,
  RuntimeCandidateConflictKind,
  RuntimeCandidateConflictReport,
  RuntimeCandidateConflictRow,
} from "./runtimeStabilityTypes";

function row(
  kind: RuntimeCandidateConflictKind,
  labelKo: string,
  severity: CandidateConflictSeverity,
  noteKo: string
): RuntimeCandidateConflictRow {
  return { kind, labelKo, severity, noteKo };
}

function maxSeverity(rows: readonly RuntimeCandidateConflictRow[]): CandidateConflictSeverity {
  const order: CandidateConflictSeverity[] = ["low", "medium", "high"];
  let max: CandidateConflictSeverity = "low";
  for (const r of rows) {
    if (order.indexOf(r.severity) > order.indexOf(max)) max = r.severity;
  }
  return max;
}

export function evaluateRuntimeCandidateConflicts(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly candidateReport: RuntimeEnforcementCandidateReport;
  readonly capabilityPlanning: CandidateCapabilityPlanningReport;
  readonly controlledGovernance: ControlledEnforcementGovernanceReport;
  readonly dependencyPlanning: GovernanceDependencyPlanningReport;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly saturationLevel: CandidateSaturationLevel;
}): RuntimeCandidateConflictReport {
  const { governance, rollbackSafety } = input.governanceCtx;
  const pressure = evaluateResourcePressure(input.extract);
  const conflicts: RuntimeCandidateConflictRow[] = [];

  const candidateRows = input.capabilityPlanning.rows.filter((r) => r.status === "candidate");
  const hasProviderCandidate = candidateRows.some((r) => r.kind === "provider_routing");
  const hasExecutionCandidate = candidateRows.some((r) => r.kind === "execution_gating");
  const hasApprovalCandidate = candidateRows.some((r) => r.kind === "approval_gating");

  if (hasProviderCandidate && hasExecutionCandidate && governance.governanceRisk !== "low") {
    conflicts.push(
      row(
        "provider_routing_conflict",
        "프로바이더 라우팅 vs 실행 게이팅",
        "medium",
        "동시 후보로 문서화되나 거버넌스 리스크가 있어 orchestration stability가 낮아질 수 있습니다(실제 전환 없음)."
      )
    );
  }

  if (
    input.candidateReport.candidateEligible &&
    rollbackSafety.rollbackRisk === "high" &&
    input.dependencyPlanning.rows.some((d) => d.rollbackDependency === "required")
  ) {
    conflicts.push(
      row(
        "rollback_dependency_conflict",
        "후보 적격 vs 롤백 고위험",
        "high",
        "롤백 dependency가 필수인데 롤백 안전 메타가 높음 — 후보 우선순위를 낮추는 planning 권고."
      )
    );
  }

  if (
    input.controlledGovernance.eligibleCandidates.length > 0 &&
    !input.controlledGovernance.governanceReadinessEligible
  ) {
    conflicts.push(
      row(
        "governance_dependency_conflict",
        "후보 목록 vs governance 비준비",
        "medium",
        "H11 후보와 H11.5 governance readiness가 불일치합니다."
      )
    );
  }

  const reviewItems =
    (input.extract?.reviewSecurityHarnessPlan?.checklist?.length ?? 0) +
    (input.extract?.reviewSecurityIssuePlanningReport?.issues?.length ?? 0);
  if (reviewItems >= 8) {
    conflicts.push(
      row(
        "review_security_overload",
        "Review/Security planning 과다",
        reviewItems >= 12 ? "high" : "medium",
        `계획 블록 ${reviewItems}건 — enforcement candidate 판단 노이즈 가능.`
      )
    );
  }

  if (!input.messageExplainabilityAvailable || !input.baseline.userVisibleSummaryReady) {
    conflicts.push(
      row(
        "explainability_overload",
        "Explainability 불안정",
        "medium",
        "사용자 explainability·요약 경로가 불안정하면 후보 메타 신뢰가 떨어집니다."
      )
    );
  }

  if (
    pressure.pressureSeverity === "critical" ||
    pressure.pressureSeverity === "high" ||
    input.saturationLevel === "high"
  ) {
    conflicts.push(
      row(
        "resource_saturation",
        "자원·후보 포화",
        pressure.pressureSeverity === "critical" ? "high" : "medium",
        `자원 압력 ${pressure.pressureSeverity}, saturation ${input.saturationLevel}.`
      )
    );
  }

  if (governance.approvalMode === "disabled" && hasApprovalCandidate) {
    conflicts.push(
      row(
        "governance_dependency_conflict",
        "승인 비활성 vs 승인 게이팅 후보",
        "high",
        "approvalMode disabled인데 승인 게이팅 후보 행이 존재합니다."
      )
    );
  }

  const blockedCandidates = [
    ...input.candidateReport.blockedCapabilities,
    ...input.controlledGovernance.blockedCandidates,
  ].slice(0, 12);

  const recommendedCandidates = input.controlledGovernance.governanceReadinessEligible
    ? input.controlledGovernance.eligibleCandidates.slice(0, 8)
    : candidateRows.map((r) => r.labelKo).slice(0, 6);

  return {
    mode: "runtime_candidate_conflict_report",
    actualRuntimeEnforcementEnabled: false,
    conflicts: conflicts.slice(0, 10),
    severity: conflicts.length > 0 ? maxSeverity(conflicts) : "low",
    blockedCandidates,
    recommendedCandidates,
    saturationLevel: input.saturationLevel,
  };
}

export function serializeRuntimeCandidateConflictReportForDiagnostic(
  report: RuntimeCandidateConflictReport
): Readonly<Record<string, unknown>> {
  return {
    mode: report.mode,
    actualRuntimeEnforcementEnabled: report.actualRuntimeEnforcementEnabled,
    conflicts: report.conflicts.map((c) => ({
      kind: c.kind,
      labelKo: c.labelKo,
      severity: c.severity,
      noteKo: c.noteKo,
    })),
    severity: report.severity,
    blockedCandidates: [...report.blockedCandidates],
    recommendedCandidates: [...report.recommendedCandidates],
    saturationLevel: report.saturationLevel,
  };
}
