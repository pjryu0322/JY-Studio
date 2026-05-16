/**
 * H23 — control boundary·trial·governance 기준 **execution candidate** 판정(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeExecutionCandidateRisk,
  RuntimeExecutionCandidateStatus,
} from "./runtimeExecutionCandidateTypes";
import { mergeSortedUniqueKo } from "./runtimeExecutionCandidateMerge";

export type EvaluatedRuntimeExecutionCandidateCore = Readonly<{
  candidateStatus: RuntimeExecutionCandidateStatus;
  candidateRisk: RuntimeExecutionCandidateRisk;
  rationaleKo: string;
  requiredApprovals: readonly string[];
  rollbackPrerequisites: readonly string[];
  recommendationExtras: readonly string[];
}>;

export function evaluateRuntimeExecutionCandidate(
  reports: RuntimeSemanticPlanningReportsBeforeExecutionCandidate,
  blockers: readonly string[]
): EvaluatedRuntimeExecutionCandidateCore {
  const b = reports.runtimeControlBoundarySummary;
  const v = reports.runtimeControlBoundaryViolationReport;
  const trial = reports.runtimeResourceAllocationTrialReport;
  const drift = reports.runtimeAllocationTrialDriftSummary;
  const gov = reports.runtimeResourceGovernanceSummary;
  const alloc = reports.runtimeResourceAllocationPlan;
  const resBoundary = reports.runtimeResourceControlBoundary.boundary;

  const hasWording = v.wordingRiskFindings.length > 0;

  if (blockers.length > 0) {
    return {
      candidateStatus: "blocked",
      candidateRisk: "blocked",
      rationaleKo: `실행 후보 경로가 차단되었습니다(메타). 선행 차단: ${blockers[0] ?? "—"}.`,
      requiredApprovals: mergeSortedUniqueKo(
        gov.operatorReviewRequirement === "required" ? ["operator review (메타; 실제 승인 아님)"] : []
      ),
      rollbackPrerequisites: mergeSortedUniqueKo([
        "rollback safety planning 메타 선행(실제 rollback·merge 차단 없음)",
      ]),
      recommendationExtras: mergeSortedUniqueKo([
        "candidate 경로 차단 — governance·trial·boundary 메타 점검",
      ]),
    };
  }

  if (b.boundaryLevel === "read_only") {
    return {
      candidateStatus: "not_candidate",
      candidateRisk: "stable",
      rationaleKo: "read_only 경계 — allocation trial 대상 없음. runtime execution 후보 설명 메타 제외.",
      requiredApprovals: [],
      rollbackPrerequisites: mergeSortedUniqueKo(["해당 없음(메타)"]),
      recommendationExtras: [],
    };
  }

  if (b.boundaryLevel === "execution_candidate_metadata") {
    return {
      candidateStatus: "operator_review_required",
      candidateRisk: "elevated",
      rationaleKo:
        "execution_candidate_metadata 경계 — 후보 경로 설명만 가능. actual orchestration·실행 없음.",
      requiredApprovals: mergeSortedUniqueKo([
        "operator 확인(메타)",
        ...(gov.operatorReviewRequirement !== "not_required" ? ["governance operator review 메타"] : []),
      ]),
      rollbackPrerequisites: mergeSortedUniqueKo([
        "rollback readiness planning 메타",
        "governance·allocation alignment 메타",
      ]),
      recommendationExtras: mergeSortedUniqueKo([
        "H23 이전 단계 — provider switching·execution routing 메타 금지",
      ]),
    };
  }

  if (b.boundaryLevel === "dry_run_metadata") {
    let risk: RuntimeExecutionCandidateRisk = "stable";
    if (trial.consistency === "watch" || drift.driftLevel === "watch") risk = "watch";
    if (trial.consistency === "drift_detected" || drift.driftLevel === "elevated") risk = "elevated";
    if (hasWording) risk = risk === "stable" ? "watch" : risk;

    if (trial.consistency === "consistent") {
      return {
        candidateStatus: "metadata_candidate",
        candidateRisk: risk,
        rationaleKo:
          "dry_run_metadata + trial consistency consistent — 후보 경로 설명 메타만(실제 trial 실행 없음).",
        requiredApprovals: mergeSortedUniqueKo(
          gov.operatorReviewRequirement === "required" ? ["operator review (메타)"] : []
        ),
        rollbackPrerequisites: mergeSortedUniqueKo([
          "가상 actual runtime 전 rollback planning 메타(실제 rollback 없음)",
        ]),
        recommendationExtras: mergeSortedUniqueKo(
          hasWording ? ["wording risk 후보 — planning 문구 정렬(메타)"] : []
        ),
      };
    }
    return {
      candidateStatus: "metadata_candidate",
      candidateRisk: risk,
      rationaleKo:
        "dry_run_metadata이나 trial consistency가 완전 일치는 아님 — 후보 설명 메타만, 실행 신호 아님.",
      requiredApprovals: mergeSortedUniqueKo(
        gov.operatorReviewRequirement === "required" ? ["operator review (메타)"] : []
      ),
      rollbackPrerequisites: mergeSortedUniqueKo(["drift·consistency watch — rollback planning 메타 선행"]),
      recommendationExtras: mergeSortedUniqueKo(["trial consistency·drift 메타 재확인"]),
    };
  }

  if (b.boundaryLevel === "planning_metadata") {
    const weakSignal =
      alloc.globalAllocationMode === "dry_run_candidate" &&
      resBoundary === "trial_candidate" &&
      trial.consistency !== "blocked";
    if (weakSignal) {
      return {
        candidateStatus: "metadata_candidate",
        candidateRisk: "watch",
        rationaleKo:
          "planning_metadata이나 allocation·boundary가 trial/dry-run 후보 신호 — 설명 메타만(실행 아님).",
        requiredApprovals: mergeSortedUniqueKo(
          gov.operatorReviewRequirement === "required" ? ["operator review (메타)"] : []
        ),
        rollbackPrerequisites: mergeSortedUniqueKo(["governance alignment 메타"]),
        recommendationExtras: mergeSortedUniqueKo(["metadata_candidate는 실행 허가가 아님"]),
      };
    }
    return {
      candidateStatus: "not_candidate",
      candidateRisk: "stable",
      rationaleKo: "planning_metadata 기본 구간 — runtime execution 후보 설명 메타에서 제외.",
      requiredApprovals: [],
      rollbackPrerequisites: mergeSortedUniqueKo(["해당 없음(메타)"]),
      recommendationExtras: [],
    };
  }

  return {
    candidateStatus: "not_candidate",
    candidateRisk: b.boundaryRisk === "violation_candidate" ? "watch" : "stable",
    rationaleKo: "기본적으로 execution candidate 설명 메타 범위 밖(실제 control·실행 없음).",
    requiredApprovals: [],
    rollbackPrerequisites: mergeSortedUniqueKo(["해당 없음(메타)"]),
    recommendationExtras: [],
  };
}
