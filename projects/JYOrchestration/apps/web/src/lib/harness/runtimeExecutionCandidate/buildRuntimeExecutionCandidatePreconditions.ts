/**
 * H23 — execution candidate **사전 조건** 문구(read-only; report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "./runtimeExecutionCandidateMerge";

export function buildRuntimeExecutionCandidatePreconditions(
  reports: RuntimeSemanticPlanningReportsBeforeExecutionCandidate
): readonly string[] {
  const b = reports.runtimeControlBoundarySummary.boundaryLevel;
  const trial = reports.runtimeResourceAllocationTrialReport;
  const gov = reports.runtimeResourceGovernanceSummary;
  const rows: string[] = [
    "control boundary가 dry_run_metadata 또는 execution_candidate_metadata일 때 후보 경로 설명 메타가 의미 있음(실행 아님)",
    "planning diagnostic 트리에 actual*Enabled=true 없음(메타)",
    "trial consistency가 blocked가 아니어야 후보 설명 메타가 유효함",
    "operator review가 required이면 검토 메타가 선행되어야 함(실제 승인 아님)",
    "가상 actual runtime 이전에 rollback readiness planning 메타가 준비되어야 함(실제 rollback 없음)",
  ];
  if (b === "read_only") {
    rows.push("read_only 경계 — execution candidate 설명은 제한적(메타)");
  }
  if (trial.trialMode === "dry_run_ready") {
    rows.push("dry-run readiness 메타가 일치하면 후보 설명 신뢰도 상승(실행 없음)");
  }
  if (gov.governanceRisk === "critical_candidate") {
    rows.push("governance critical_candidate 시 후보 설명보다 차단 메타 우선(실행 없음)");
  }
  return mergeSortedUniqueKo(rows);
}
