/**
 * Business Execution domain — persisted-entity-like artifacts and session snapshot typing.
 *
 * This domain models the business-side execution pipeline (request → approval → package → assignment →
 * launch artifacts → run → integration → connector). It is intentionally separate from Stage1/Stage2
 * environment/procedure test flows; do not merge lifecycle types across that boundary.
 *
 * A. Core entities (stored per session where applicable):
 *    BusinessExecutionRequest, Approval, Package, Assignment, BusinessExecutionRun, …
 * B. Collaboration / preparation inputs live alongside: ExecutionLaunchSnapshot, task readiness, drafts.
 * C. Derived / current / stale flags are computed in selectors (see businessExecutionSelectors,
 *    preExecutionSelectors), not embedded as DB-shaped rows here.
 */

export type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
export type { BusinessExecutionApproval } from "@/lib/workflow/businessExecutionApproval";
export type { BusinessExecutionPackage } from "@/lib/workflow/businessExecutionPackage";
export type { ExecutionAssignment } from "@/lib/workflow/executionAssignment";
export type { BusinessExecutionRun, BusinessExecutionRunStatus } from "@/lib/workflow/businessExecutionRun";

export type {
  BusinessExecutionRequestEntity,
  BusinessExecutionApprovalEntity,
  BusinessExecutionPackageEntity,
  ExecutionAssignmentEntity,
  BusinessExecutionRunEntity,
} from "@/lib/workflow/businessExecutionEntityModels";

export type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";
export type { ExecutionRequestDraft } from "@/lib/workflow/executionRequestDraft";
export type { ExecutionRequestApproval } from "@/lib/workflow/executionRequestApproval";

/** Full per-session business + pre-execution selector shape (entities + derived fields). */
export type { PreExecutionSessionSelector as BusinessExecutionSessionState } from "@/lib/workflow/preExecutionSelectors";
