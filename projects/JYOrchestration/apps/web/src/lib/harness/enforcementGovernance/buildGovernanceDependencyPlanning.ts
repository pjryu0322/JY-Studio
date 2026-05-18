/**
 * H11.5 — governance **dependency** planning(read-only). 실제 enforcement 없음.
 */

import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { ControlledEnforcementGovernanceReport } from "./controlledEnforcementGovernanceTypes";
import type {
  EnforcementApprovalRequirement,
  EnforcementRollbackDependency,
  GovernanceDependencyKind,
  GovernanceDependencyPlanningReport,
  GovernanceDependencyPlanningRow,
} from "./controlledEnforcementGovernanceTypes";

function row(
  kind: GovernanceDependencyKind,
  labelKo: string,
  approvalRequirement: EnforcementApprovalRequirement,
  rollbackDependency: EnforcementRollbackDependency,
  noteKo: string
): GovernanceDependencyPlanningRow {
  return { kind, labelKo, approvalRequirement, rollbackDependency, noteKo };
}

export function buildGovernanceDependencyPlanning(input: {
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly controlledGovernance: ControlledEnforcementGovernanceReport;
}): GovernanceDependencyPlanningReport {
  const { governance, rollbackSafety } = input.governanceCtx;
  const rbDep: EnforcementRollbackDependency =
    rollbackSafety.rollbackRisk === "high"
      ? "required"
      : rollbackSafety.rollbackRisk === "watch"
        ? "recommended"
        : "optional";

  const opApproval: EnforcementApprovalRequirement =
    governance.operatorReviewReadiness === "required" ? "operator_required" : "governance_required";

  const auditReq: EnforcementApprovalRequirement =
    governance.auditabilityLevel === "extended_planning" ? "auditability_required" : "governance_required";

  const rows: GovernanceDependencyPlanningRow[] = [
    row(
      "provider_routing",
      "프로바이더 라우팅 dependency",
      opApproval,
      rbDep,
      input.controlledGovernance.governanceReadinessEligible
        ? "운영 검토·롤백 계획이 전제일 때만 후보로 문서화(실제 전환 없음)."
        : "거버넌스 준비도 미충족 시 planning만 허용."
    ),
    row(
      "execution_gating",
      "실행 게이팅 dependency",
      "governance_required",
      rbDep,
      "Dry-run·경고만; 실제 execution blocking 없음."
    ),
    row(
      "rollback",
      "롤백 dependency",
      "operator_required",
      "required",
      `롤백 안전 ${rollbackSafety.rollbackRisk}, 통제 시험 준비도 연동.`
    ),
    row(
      "auditability",
      "감사 추적 dependency",
      auditReq,
      "optional",
      "감사 후보 이벤트 유형은 계획 메타만; 실제 audit 저장 없음."
    ),
    row(
      "operator_approval",
      "운영자 승인 dependency",
      "operator_required",
      "recommended",
      `승인 모드 ${governance.approvalMode}, 운영 검토 ${governance.operatorReviewReadiness}.`
    ),
  ];

  return {
    mode: "governance_dependency_planning_only",
    actualEnforcementEnabled: false,
    rows,
  };
}

export function serializeGovernanceDependencyPlanningForDiagnostic(
  report: GovernanceDependencyPlanningReport
): Readonly<Record<string, unknown>> {
  return {
    mode: report.mode,
    actualEnforcementEnabled: report.actualEnforcementEnabled,
    rows: report.rows.map((r) => ({
      kind: r.kind,
      labelKo: r.labelKo,
      approvalRequirement: r.approvalRequirement,
      rollbackDependency: r.rollbackDependency,
      noteKo: r.noteKo,
    })),
  };
}
