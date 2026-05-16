/**
 * H24 — H23.5·H23·H22.5 결과를 종합한 **controlled pilot readiness**(read-only; 실제 pilot 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlledPilot } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeControlledPilotReadiness,
  RuntimeControlledPilotScope,
} from "./runtimeControlledPilotTypes";

export type EvaluatedRuntimeControlledPilotReadinessCore = Readonly<{
  readiness: RuntimeControlledPilotReadiness;
  pilotScope: RuntimeControlledPilotScope;
  rationaleKo: string;
  candidateFlowKo: string;
  recommendationExtras: readonly string[];
}>;

export function evaluateRuntimeControlledPilotReadiness(
  reports: RuntimeSemanticPlanningReportsBeforeControlledPilot
): EvaluatedRuntimeControlledPilotReadinessCore {
  const p = reports.runtimePilotPreconditionSummary;
  const ecs = reports.runtimeExecutionCandidateSummary;
  const b = reports.runtimeControlBoundarySummary;
  const a = reports.runtimeOperatorApprovalSummary;
  const r = reports.runtimeRollbackReadinessSummary;
  const u = reports.runtimeAuditReadinessSummary;

  const blockedPath =
    p.pilotPreconditionReadiness === "blocked" ||
    ecs.candidateStatus === "blocked" ||
    b.boundaryRisk === "blocked" ||
    a.approvalReadiness === "blocked" ||
    r.rollbackReadiness === "blocked" ||
    u.auditReadiness === "blocked";

  const watchPath =
    p.pilotPreconditionReadiness === "watch" ||
    a.approvalReadiness === "review_required" ||
    r.rollbackReadiness === "metadata_watch" ||
    u.auditReadiness === "watch";

  const metadataReadyPath =
    p.pilotPreconditionReadiness === "metadata_only" &&
    ecs.candidateStatus === "metadata_candidate" &&
    !blockedPath;

  let readiness: RuntimeControlledPilotReadiness;
  if (blockedPath) {
    readiness = "blocked";
  } else if (watchPath) {
    readiness = "watch";
  } else if (metadataReadyPath) {
    readiness = "metadata_ready";
  } else {
    readiness = "not_ready";
  }

  let pilotScope: RuntimeControlledPilotScope;
  if (readiness === "blocked") {
    pilotScope = "blocked";
  } else if (readiness === "not_ready") {
    pilotScope = "none";
  } else if (readiness === "watch") {
    pilotScope = "diagnostic_only";
  } else {
    pilotScope = "single_flow_metadata";
  }

  const rationaleKo = blockedPath
    ? "controlled pilot 후보 메타 차단 — 전제·후보·경계·승인·rollback·감사 중 blocked 신호(실제 pilot 없음)."
    : readiness === "metadata_ready"
      ? "단일 flow pilot 후보 메타만 고정 가능. actual orchestration·provider routing·실행 없음."
      : readiness === "watch"
        ? "pilot 후보 메타 주시 — 검토·drift·감사 신호 확인(실제 pilot 없음)."
        : "controlled pilot 후보 메타 미충족 — H23.5 이전 단계 정렬(실제 pilot 없음).";

  const candidateFlowKo = `후보 flow(메타): candidate=${ecs.candidateStatus}, boundary=${b.boundaryLevel}, pilot전제=${p.pilotPreconditionReadiness}, 승인=${a.approvalReadiness}, rollback=${r.rollbackReadiness}, 감사=${u.auditReadiness}(실행 없음).`;

  const recommendationExtras = mergeSortedUniqueKo([
    ...ecs.recommendations,
    ...a.recommendations,
    ...(readiness === "metadata_ready"
      ? ["H24: pilot 후보만 메타 고정 — runtime 실행·routing 금지 유지"]
      : []),
    ...(readiness === "blocked" ? ["H24: pilot 후보 차단 메타 — 선행 blocked 해소"] : []),
  ]);

  return {
    readiness,
    pilotScope,
    rationaleKo,
    candidateFlowKo,
    recommendationExtras,
  };
}
