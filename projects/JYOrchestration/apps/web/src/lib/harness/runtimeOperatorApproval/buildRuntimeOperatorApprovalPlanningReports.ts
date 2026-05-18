/**
 * H23.5 — operator approval·rollback·audit·pilot precondition planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeOperatorApproval } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { buildRuntimePilotPreconditionSummary } from "./buildRuntimePilotPreconditionSummary";
import { evaluateRuntimeAuditReadiness } from "./evaluateRuntimeAuditReadiness";
import { evaluateRuntimeOperatorApprovalReadiness } from "./evaluateRuntimeOperatorApprovalReadiness";
import { evaluateRuntimeRollbackReadiness } from "./evaluateRuntimeRollbackReadiness";
import type { RuntimeOperatorApprovalPlanningReports } from "./runtimeOperatorApprovalTypes";

export type { RuntimeOperatorApprovalPlanningReports } from "./runtimeOperatorApprovalTypes";

export function buildRuntimeOperatorApprovalPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeOperatorApproval
): RuntimeOperatorApprovalPlanningReports {
  const runtimeOperatorApprovalSummary = evaluateRuntimeOperatorApprovalReadiness(reports);
  const runtimeRollbackReadinessSummary = evaluateRuntimeRollbackReadiness(reports);
  const runtimeAuditReadinessSummary = evaluateRuntimeAuditReadiness(reports);
  const runtimePilotPreconditionSummary = buildRuntimePilotPreconditionSummary(reports, {
    approvalReadiness: runtimeOperatorApprovalSummary.approvalReadiness,
    rollbackReadiness: runtimeRollbackReadinessSummary.rollbackReadiness,
    auditReadiness: runtimeAuditReadinessSummary.auditReadiness,
  });

  return {
    runtimeOperatorApprovalSummary,
    runtimeRollbackReadinessSummary,
    runtimeAuditReadinessSummary,
    runtimePilotPreconditionSummary,
  };
}
