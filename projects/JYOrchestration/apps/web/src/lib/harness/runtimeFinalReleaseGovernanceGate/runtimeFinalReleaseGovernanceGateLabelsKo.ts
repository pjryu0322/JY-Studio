/**
 * H39 — final release governance gate overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeFinalReleaseGovernanceGateAlignmentStatus,
  RuntimeFinalReleaseGovernanceGateCandidateStatus,
  RuntimeFinalReleaseGovernanceGateFinalGateStatus,
  RuntimeFinalReleaseGovernanceGateMode,
  RuntimeFinalReleaseGovernanceGateVerificationStatus,
} from "./runtimeFinalReleaseGovernanceGateTypes";

export const RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 release/execution/approval enforcement가 아니라, final release governance gate 후보를 설명하는 read-only metadata입니다.";

export const RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_OVERLAY_FOOTER_KO =
  "actual execution·execution routing·release enforcement·approval enforcement·shell execution·adapter invocation·routing·queue control·rollback·execution blocking·merge blocking·prompt 변경은 없습니다.";

export const RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_CANDIDATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeFinalReleaseGovernanceGateCandidateStatus, string>
> = {
  not_candidate: "미후보",
  final_release_governance_gate_metadata_candidate: "final release governance gate 메타 후보",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_MODE_LABEL_KO: Readonly<
  Record<RuntimeFinalReleaseGovernanceGateMode, string>
> = {
  disabled: "비활성(메타)",
  metadata_only: "메타만",
  blocked: "차단",
};

export const RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_FINAL_GATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeFinalReleaseGovernanceGateFinalGateStatus, string>
> = {
  ready_metadata: "ready(메타)",
  watch: "주시",
  blocked: "차단",
  not_ready: "미준비",
};

export const RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_VERIFICATION_STATUS_LABEL_KO: Readonly<
  Record<RuntimeFinalReleaseGovernanceGateVerificationStatus, string>
> = {
  verified_metadata: "verified(메타)",
  partial: "부분",
  failed: "실패",
};

export const RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ALIGNMENT_STATUS_LABEL_KO: Readonly<
  Record<RuntimeFinalReleaseGovernanceGateAlignmentStatus, string>
> = {
  aligned_metadata: "aligned(메타)",
  partial: "부분",
  failed: "실패",
};

export const RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_EMPTY_HINT_KO = {
  scope: "gate scope 행 없음",
  forbiddenOperation: "금지 gate operation 없음",
  checklist: "readiness checklist 행 없음",
  missingChecklist: "누락 checklist 항목 없음",
  blocker: "final release governance gate blocker 없음",
  boundaryViolation: "final gate violation 없음",
  readinessFinding: "readiness verification finding 없음",
  alignmentFinding: "alignment finding 없음",
  finalGateChecklist: "final gate checklist 행 없음",
  recommendation: "recommendation 없음",
};
