/**
 * H21 — Overlay·진단용 governance 라벨(KO).
 */

import type {
  RuntimeResourceAllocationReadiness,
  RuntimeResourceGovernanceMode,
  RuntimeResourceGovernanceRisk,
  RuntimeResourceOperatorReviewRequirement,
} from "./runtimeResourceGovernanceTypes";

export const RUNTIME_RESOURCE_GOVERNANCE_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 resource allocation이나 runtime control이 아니라, resource pressure를 운영 정책으로 해석한 read-only governance metadata입니다.";

export const RUNTIME_RESOURCE_GOVERNANCE_RISK_LABEL_KO: Readonly<Record<RuntimeResourceGovernanceRisk, string>> = {
  stable: "Governance risk · 안정",
  watch: "Governance risk · 관찰",
  elevated: "Governance risk · 상승",
  critical_candidate: "Governance risk · 임계 후보",
};

export const RUNTIME_RESOURCE_GOVERNANCE_MODE_LABEL_KO: Readonly<Record<RuntimeResourceGovernanceMode, string>> = {
  observe_only: "Governance mode · 관측 전용",
  planning_only: "Governance mode · planning 메타만",
  trial_candidate: "Governance mode · trial 후보 신호(실행 아님)",
  control_not_allowed: "Governance mode · 제어 경로 비허용(메타)",
};

export const RUNTIME_RESOURCE_OPERATOR_REVIEW_LABEL_KO: Readonly<
  Record<RuntimeResourceOperatorReviewRequirement, string>
> = {
  not_required: "Operator review · 불필요(메타)",
  recommended: "Operator review · 권장(메타)",
  required: "Operator review · 필요(메타)",
};

export const RUNTIME_RESOURCE_ALLOCATION_READINESS_LABEL_KO: Readonly<
  Record<RuntimeResourceAllocationReadiness, string>
> = {
  not_ready: "Allocation readiness · 후보 없음",
  planning_metadata_only: "Allocation readiness · planning 메타만",
  allocation_planning_candidate: "Allocation readiness · allocation planning 후보",
  trial_signal_blocked: "Allocation readiness · trial 신호 차단(메타)",
};
