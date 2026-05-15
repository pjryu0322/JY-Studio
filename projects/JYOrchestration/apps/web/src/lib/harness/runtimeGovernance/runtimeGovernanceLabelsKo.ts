/**
 * H10.5 — Overlay·진단 공통 한글 라벨(read-only 표시용).
 */

import type {
  RollbackSafetyRiskLevel,
  RuntimeApprovalMode,
  RuntimeGovernanceAuditabilityLevel,
  RuntimeGovernanceRiskLevel,
  RuntimeOperatorReviewReadiness,
  RuntimeRollbackReadiness,
} from "./runtimeGovernanceTypes";

export const RUNTIME_GOVERNANCE_APPROVAL_LABEL_KO: Record<RuntimeApprovalMode, string> = {
  manual_only: "수동만 허용(자동 승인·위임 없음)",
  operator_review_required: "운영자 검토 필요",
  disabled: "위임형 거버넌스 비활성(문서·수동만)",
};

export const RUNTIME_GOVERNANCE_ROLLBACK_READINESS_LABEL_KO: Record<RuntimeRollbackReadiness, string> = {
  not_ready: "롤백 계획 수립 전",
  planning_only: "계획·문서 단계만",
  dry_run_ready: "dry-run·문서 시험 준비(실행 아님)",
};

export const RUNTIME_GOVERNANCE_RISK_LABEL_KO: Record<RuntimeGovernanceRiskLevel, string> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};

export const ROLLBACK_SAFETY_RISK_LABEL_KO: Record<RollbackSafetyRiskLevel, string> = {
  stable: "안정",
  watch: "주시",
  high: "높음",
};

export function runtimeGovernanceAuditabilityLevelLabelKo(level: RuntimeGovernanceAuditabilityLevel): string {
  if (level === "none") return "감사 메타: 최소(시험 전)";
  if (level === "basic_planning") return "감사 메타: 기본 계획";
  return "감사 메타: 확장 계획(문서화 권장)";
}

export function runtimeGovernanceOperatorReviewLabelKo(readiness: RuntimeOperatorReviewReadiness): string {
  if (readiness === "not_ready") return "운영 검토: 대기(차단 요인 있음)";
  if (readiness === "recommended") return "운영 검토: 권장";
  return "운영 검토: 필수";
}

export const RUNTIME_GOVERNANCE_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 runtime governance enforcement가 아니라 governance 준비 상태를 보여주는 read-only 진단 정보입니다.";

export const RUNTIME_GOVERNANCE_EMPTY_BLOCKERS_LABEL_KO = "현재 표시할 거버넌스 차단 요약이 없습니다.";
