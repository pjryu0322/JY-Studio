/**
 * H40 — ultimate governance review **summary**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  isRuntimeOrchestrationForbiddenProofComplete,
  isRuntimeUltimateNoEnforcementProofValid,
  readUltimateGovernanceUpstreamContext,
  resolveRuntimeUltimateGovernanceReviewStatus,
} from "./runtimeUltimateGovernanceReviewCheckHelpers";
import { resolveRuntimeUltimateGovernanceReviewMode } from "./resolveRuntimeUltimateGovernanceReviewMode";
import { RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED } from "./runtimeUltimateGovernanceReviewConstants";
import type {
  RuntimeOrchestrationForbiddenProof,
  RuntimeUltimateGovernanceBlockerReport,
  RuntimeUltimateGovernanceReviewStatus,
  RuntimeUltimateGovernanceReviewSummary,
  RuntimeUltimateNoEnforcementProof,
} from "./runtimeUltimateGovernanceReviewTypes";

function reviewRationaleKo(status: RuntimeUltimateGovernanceReviewStatus): string {
  switch (status) {
    case "ultimate_governance_metadata_ready":
      return "final release governance gate·H40 entry readiness 정렬 — ultimate governance review 메타 후보(실제 orchestration·enforcement 없음).";
    case "watch":
      return "ultimate governance review 주시 — final gate watch·partial verification(orchestration·blocking 금지).";
    case "blocked":
      return "ultimate governance review 차단 — final gate·blocker·proof 정렬 필요.";
    default:
      return "ultimate governance review 미준비 — H39.5 final release governance gate final safety gate 선행.";
  }
}

export function buildRuntimeUltimateGovernanceReviewSummary(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview;
  readonly blockerReport: RuntimeUltimateGovernanceBlockerReport;
  readonly noEnforcementProof: RuntimeUltimateNoEnforcementProof;
  readonly forbiddenProof: RuntimeOrchestrationForbiddenProof;
}): RuntimeUltimateGovernanceReviewSummary {
  const { reports, blockerReport, noEnforcementProof, forbiddenProof } = input;
  const upstream = readUltimateGovernanceUpstreamContext(reports);
  const { finalSummary } = upstream;

  const reviewBlockers: string[] = [];
  if (blockerReport.blockers.length > 0) {
    reviewBlockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (finalSummary.gateBlockers.length > 0) {
    reviewBlockers.push(...finalSummary.gateBlockers.slice(0, 2));
  }
  if (!isRuntimeUltimateNoEnforcementProofValid(noEnforcementProof)) {
    reviewBlockers.push("ultimate no-enforcement proof diagnosticOnly must be true");
  }
  if (!isRuntimeOrchestrationForbiddenProofComplete(forbiddenProof)) {
    reviewBlockers.push("orchestration-forbidden proof incomplete");
  }

  const reviewStatus = resolveRuntimeUltimateGovernanceReviewStatus({
    upstream,
    noEnforcementProof,
    forbiddenProof,
    ultimateBlockerCount: blockerReport.blockers.length,
  });
  const reviewMode = resolveRuntimeUltimateGovernanceReviewMode(reviewStatus);

  return {
    mode: "runtime_ultimate_governance_review_summary",
    ...RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
    reviewStatus,
    reviewMode,
    rationaleKo: reviewRationaleKo(reviewStatus),
    reviewBlockers: mergeSortedUniqueKo(reviewBlockers),
    recommendations: mergeSortedUniqueKo([
      ...(reviewStatus === "ultimate_governance_metadata_ready"
        ? ["H40: ultimate governance review ready — final orchestration readiness boundary 후보(orchestration 없음)"]
        : []),
      ...(reviewStatus === "watch"
        ? ["H40: ultimate governance review watch — final gate·alignment·wording risk 재검토"]
        : []),
      ...(reviewStatus === "blocked"
        ? ["H40: ultimate governance review blocked — blocker·proof·verification 정렬"]
        : []),
      ...(reviewStatus === "not_ready"
        ? ["H40: ultimate governance review not_ready — H39.5 final safety gate 선행"]
        : []),
    ]),
  };
}
