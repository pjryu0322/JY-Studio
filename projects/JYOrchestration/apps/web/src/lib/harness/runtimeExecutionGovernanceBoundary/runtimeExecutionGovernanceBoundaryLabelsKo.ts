/**
 * H37 — governance boundary overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeExecutionGovernanceBoundaryAlignmentStatus,
  RuntimeExecutionGovernanceBoundaryCandidateStatus,
  RuntimeExecutionGovernanceBoundaryFinalGateStatus,
  RuntimeExecutionGovernanceBoundaryHardeningReadiness,
  RuntimeExecutionGovernanceBoundaryMode,
  RuntimeExecutionGovernanceBoundaryReadinessVerificationStatus,
} from "./runtimeExecutionGovernanceBoundaryTypes";

export const RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 execution/governance enforcement가 아니라, final execution governance boundary 후보를 설명하는 read-only metadata입니다.";

export const RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_OVERLAY_FOOTER_KO =
  "actual execution·execution routing·release enforcement·shell execution·runtime adapter invocation·routing·queue control·rollback·approval enforcement·prompt 변경은 없습니다.";

export const RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_CANDIDATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeExecutionGovernanceBoundaryCandidateStatus, string>
> = {
  not_candidate: "미후보",
  governance_boundary_metadata_candidate: "governance boundary 메타 후보",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_MODE_LABEL_KO: Readonly<
  Record<RuntimeExecutionGovernanceBoundaryMode, string>
> = {
  disabled: "비활성(메타)",
  metadata_only: "메타만",
  blocked: "차단",
};

export const RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_HARDENING_READINESS_LABEL_KO: Readonly<
  Record<RuntimeExecutionGovernanceBoundaryHardeningReadiness, string>
> = {
  not_ready: "미준비",
  hardening_metadata_ready: "hardening ready(메타)",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_FINAL_GATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeExecutionGovernanceBoundaryFinalGateStatus, string>
> = {
  ready_metadata: "ready(메타)",
  watch: "주시",
  blocked: "차단",
  not_ready: "미준비",
};

export const RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_READINESS_VERIFICATION_STATUS_LABEL_KO: Readonly<
  Record<RuntimeExecutionGovernanceBoundaryReadinessVerificationStatus, string>
> = {
  verified_metadata: "verified(메타)",
  partial: "부분",
  failed: "실패",
};

export const RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_ALIGNMENT_STATUS_LABEL_KO: Readonly<
  Record<RuntimeExecutionGovernanceBoundaryAlignmentStatus, string>
> = {
  aligned_metadata: "aligned(메타)",
  partial: "부분",
  failed: "실패",
};

export const RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_EMPTY_HINT_KO = {
  scope: "governance scope 행 없음",
  forbiddenOperation: "금지 governance operation 없음",
  checklist: "readiness checklist 행 없음",
  missingChecklist: "누락 checklist 항목 없음",
  blocker: "governance blocker 없음",
  boundaryViolation: "governance boundary violation 없음",
  readinessFinding: "readiness verification finding 없음",
  alignmentFinding: "alignment finding 없음",
  finalGateChecklist: "final gate checklist 행 없음",
  recommendation: "recommendation 없음",
} as const;
