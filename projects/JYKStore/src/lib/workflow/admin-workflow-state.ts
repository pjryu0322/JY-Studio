/**
 * P2 admin workflow — shared state/phase vocabulary.
 *
 * These types describe the raw phase markers the admin workflow reasons
 * about. They are intentionally decoupled from Prisma/DB enums so the
 * gate + transition logic in this folder stays pure and unit-testable.
 */

export type AdminWorkflowUiState =
  | "IDLE"
  | "CURRENT"
  | "COMPLETED"
  | "ATTENTION"
  | "BLOCKED";

export type AdminWorkerZipPhase =
  | "NONE"
  | "REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

/** Provider review is a PUBLISH gate/phase — not an admin workflow step. */
export type AdminProviderReviewPhase =
  | "NONE"
  | "REQUESTED"
  | "CONFIRMED"
  | "WITHDRAWN";

export type AdminServiceValidationPhase = "NONE" | "PASSED";

export type AdminQualityGateSnapshot = {
  completed: boolean;
  failCount: number;
  hasBlockers: boolean;
  hasWarnings: boolean;
  blockers: string[];
  warnings: string[];
};

export type AdminPublishGatePhase =
  | "NOT_READY"
  | "AWAITING_SERVICE_VALIDATION"
  | "READY_FOR_PROVIDER_REVIEW"
  | "PROVIDER_REVIEW_REQUESTED"
  | "PROVIDER_APPROVED"
  | "READY_TO_PUBLISH"
  | "PUBLISHED";

const ADMIN_PUBLISH_GATE_PHASE_LABELS: Record<AdminPublishGatePhase, string> = {
  NOT_READY: "게시 준비 전",
  AWAITING_SERVICE_VALIDATION: "서비스 검증 대기 중",
  READY_FOR_PROVIDER_REVIEW: "제공자 검토 요청 가능",
  PROVIDER_REVIEW_REQUESTED: "제공자 검토 요청됨",
  PROVIDER_APPROVED: "제공자 확인 완료",
  READY_TO_PUBLISH: "게시 가능",
  PUBLISHED: "게시됨",
};

export function describeAdminPublishGatePhase(phase: AdminPublishGatePhase): string {
  return ADMIN_PUBLISH_GATE_PHASE_LABELS[phase];
}
