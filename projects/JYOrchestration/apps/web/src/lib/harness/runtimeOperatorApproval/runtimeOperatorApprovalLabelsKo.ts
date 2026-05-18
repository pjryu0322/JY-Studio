/**
 * H23.5 — Overlay·진단용 한국어 라벨(read-only).
 */

import type {
  RuntimeAuditReadiness,
  RuntimeOperatorApprovalReadiness,
  RuntimePilotPreconditionReadiness,
  RuntimeRollbackReadiness,
} from "./runtimeOperatorApprovalTypes";

export const RUNTIME_OPERATOR_APPROVAL_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 승인·rollback·runtime pilot 실행이 아니라, 운영자 검토와 복구 준비성을 설명하는 read-only metadata입니다.";

export const RUNTIME_OPERATOR_APPROVAL_READINESS_LABEL_KO: Record<RuntimeOperatorApprovalReadiness, string> = {
  not_required: "승인 메타 불필요",
  ready_for_review_metadata: "검토용 메타 준비됨(실제 승인 아님)",
  review_required: "운영자 검토 메타 필요(실제 승인 아님)",
  blocked: "승인 준비 차단(메타)",
};

export const RUNTIME_ROLLBACK_READINESS_LABEL_KO: Record<RuntimeRollbackReadiness, string> = {
  not_applicable: "롤백 메타 해당 없음",
  metadata_ready: "롤백 준비 메타 양호(실행 없음)",
  metadata_watch: "롤백 준비 메타 주시(실행 없음)",
  blocked: "롤백 준비 메타 차단(실행 없음)",
};

export const RUNTIME_AUDIT_READINESS_LABEL_KO: Record<RuntimeAuditReadiness, string> = {
  minimal: "감사 메타 최소",
  sufficient_metadata: "감사 메타 충분(집행 아님)",
  watch: "감사 메타 주시",
  blocked: "감사 메타 차단",
};

export const RUNTIME_PILOT_PRECONDITION_READINESS_LABEL_KO: Record<RuntimePilotPreconditionReadiness, string> = {
  not_ready: "파일럿 전제 메타 미충족",
  metadata_only: "메타 전제만 충족(실행 없음)",
  watch: "파일럿 전제 주시(실행 없음)",
  blocked: "파일럿 전제 차단(실행 없음)",
};
