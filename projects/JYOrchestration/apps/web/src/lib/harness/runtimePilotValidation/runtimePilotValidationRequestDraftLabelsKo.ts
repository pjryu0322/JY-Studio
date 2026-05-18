/**
 * Pilot Validation Phase 3 — request draft user-facing labels (no execution wording).
 */

import type {
  RuntimePilotValidationAuditTraceCandidateStatus,
  RuntimePilotValidationOperatorApprovalSnapshotStatus,
  RuntimePilotValidationRequestDraftStatus,
  RuntimePilotValidationRollbackPlanCandidateStatus,
} from "./runtimePilotValidationRequestDraftTypes";

export const RUNTIME_PILOT_VALIDATION_REQUEST_DRAFT_STATUS_LABEL_KO: Readonly<
  Record<RuntimePilotValidationRequestDraftStatus, string>
> = {
  draft_ready: "요청 초안 준비됨",
  watch: "요청 초안 주의 확인 필요",
  blocked: "요청 초안 차단",
  not_ready: "요청 초안 준비되지 않음",
};

export const RUNTIME_PILOT_VALIDATION_OPERATOR_APPROVAL_SNAPSHOT_STATUS_LABEL_KO: Readonly<
  Record<RuntimePilotValidationOperatorApprovalSnapshotStatus, string>
> = {
  approval_snapshot_ready: "운영자 승인 정보 준비됨",
  review_required: "운영자 검토 필요",
  blocked: "운영자 승인 정보 차단",
  not_ready: "운영자 승인 정보 준비되지 않음",
};

export const RUNTIME_PILOT_VALIDATION_AUDIT_TRACE_CANDIDATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimePilotValidationAuditTraceCandidateStatus, string>
> = {
  audit_trace_candidate_ready: "감사 추적 후보 준비됨",
  watch: "감사 추적 후보 주의",
  blocked: "감사 추적 후보 차단",
  not_ready: "감사 추적 후보 준비되지 않음",
};

export const RUNTIME_PILOT_VALIDATION_ROLLBACK_PLAN_CANDIDATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimePilotValidationRollbackPlanCandidateStatus, string>
> = {
  rollback_plan_candidate_ready: "롤백 계획 후보 준비됨",
  watch: "롤백 계획 후보 주의",
  blocked: "롤백 계획 후보 차단",
  not_ready: "롤백 계획 후보 준비되지 않음",
};
