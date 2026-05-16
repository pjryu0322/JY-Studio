/**
 * H23.5 — Overlay runtime **operator approval·rollback·audit readiness** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_AUDIT_READINESS_LABEL_KO,
  RUNTIME_OPERATOR_APPROVAL_READINESS_LABEL_KO,
  RUNTIME_OPERATOR_APPROVAL_SECTION_DISCLAIMER_KO,
  RUNTIME_PILOT_PRECONDITION_READINESS_LABEL_KO,
  RUNTIME_ROLLBACK_READINESS_LABEL_KO,
} from "@/lib/harness/runtimeOperatorApproval/runtimeOperatorApprovalLabelsKo";

export type OverlayRuntimeOperatorApprovalSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  approvalReadinessKo: string;
  rollbackReadinessKo: string;
  auditReadinessKo: string;
  pilotPreconditionReadinessKo: string;
  topApprovalBlocker: string | null;
  topRollbackBlocker: string | null;
  topAuditFinding: string | null;
  topPilotNote: string | null;
  requiredReviewRows: readonly string[];
  rollbackPrerequisiteRows: readonly string[];
  rollbackAuditHintRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeOperatorApprovalSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeOperatorApprovalSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const a = reports.runtimeOperatorApprovalSummary;
  const r = reports.runtimeRollbackReadinessSummary;
  const u = reports.runtimeAuditReadinessSummary;
  const p = reports.runtimePilotPreconditionSummary;

  const requiredReviewRows = compactAndNarrowUi ? a.requiredReviewItems.slice(0, 1) : [...a.requiredReviewItems];
  const rollbackPrerequisiteRows = compactAndNarrowUi ? r.rollbackPrerequisites.slice(0, 1) : [...r.rollbackPrerequisites];
  const rollbackAuditHintRows = compactAndNarrowUi ? r.rollbackAuditTrailHints.slice(0, 1) : [...r.rollbackAuditTrailHints];
  const recommendationRows = compactAndNarrowUi ? a.recommendations.slice(0, 1) : [...a.recommendations];

  return {
    sectionDisclaimer: RUNTIME_OPERATOR_APPROVAL_SECTION_DISCLAIMER_KO,
    showAttention:
      a.approvalReadiness === "blocked" ||
      a.approvalReadiness === "review_required" ||
      r.rollbackReadiness === "blocked" ||
      r.rollbackReadiness === "metadata_watch" ||
      u.auditReadiness === "blocked" ||
      u.auditReadiness === "watch" ||
      p.pilotPreconditionReadiness === "blocked" ||
      p.pilotPreconditionReadiness === "watch" ||
      p.pilotPreconditionReadiness === "not_ready" ||
      a.approvalBlockers.length > 0 ||
      r.rollbackBlockers.length > 0,
    showDetailSections: !compactAndNarrowUi,
    approvalReadinessKo: RUNTIME_OPERATOR_APPROVAL_READINESS_LABEL_KO[a.approvalReadiness],
    rollbackReadinessKo: RUNTIME_ROLLBACK_READINESS_LABEL_KO[r.rollbackReadiness],
    auditReadinessKo: RUNTIME_AUDIT_READINESS_LABEL_KO[u.auditReadiness],
    pilotPreconditionReadinessKo: RUNTIME_PILOT_PRECONDITION_READINESS_LABEL_KO[p.pilotPreconditionReadiness],
    topApprovalBlocker: a.approvalBlockers[0] ?? null,
    topRollbackBlocker: r.rollbackBlockers[0] ?? null,
    topAuditFinding: u.auditFindings[0] ?? null,
    topPilotNote: p.preconditionNotes[0] ?? null,
    requiredReviewRows,
    rollbackPrerequisiteRows,
    rollbackAuditHintRows,
    recommendationRows,
  };
}
