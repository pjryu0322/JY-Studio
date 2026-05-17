/**
 * H38 — governance release-readiness overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeGovernanceReleaseReadinessAlignmentStatus,
  RuntimeGovernanceReleaseReadinessFinalGateStatus,
  RuntimeGovernanceReleaseReadinessMode,
  RuntimeGovernanceReleaseReadinessStatus,
  RuntimeGovernanceReleaseReadinessVerificationStatus,
} from "./runtimeGovernanceReleaseReadinessTypes";

export const RUNTIME_GOVERNANCE_RELEASE_READINESS_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 execution/governance enforcement가 아니라, governance release-readiness와 final execution governance readiness boundary를 설명하는 read-only metadata입니다.";

export const RUNTIME_GOVERNANCE_RELEASE_READINESS_OVERLAY_FOOTER_KO =
  "actual execution·execution routing·release enforcement·approval enforcement·shell execution·runtime adapter invocation·routing·queue control·rollback·prompt 변경은 없습니다.";

export const RUNTIME_GOVERNANCE_RELEASE_READINESS_STATUS_LABEL_KO: Readonly<
  Record<RuntimeGovernanceReleaseReadinessStatus, string>
> = {
  not_ready: "미준비",
  governance_release_metadata_ready: "governance release 메타 준비됨",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_GOVERNANCE_RELEASE_READINESS_MODE_LABEL_KO: Readonly<
  Record<RuntimeGovernanceReleaseReadinessMode, string>
> = {
  disabled: "비활성(메타)",
  metadata_only: "메타만",
  blocked: "차단",
};

export const RUNTIME_GOVERNANCE_RELEASE_READINESS_FINAL_GATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeGovernanceReleaseReadinessFinalGateStatus, string>
> = {
  ready_metadata: "ready (메타)",
  watch: "주시",
  blocked: "차단",
  not_ready: "미준비",
};

export const RUNTIME_GOVERNANCE_RELEASE_READINESS_VERIFICATION_STATUS_LABEL_KO: Readonly<
  Record<RuntimeGovernanceReleaseReadinessVerificationStatus, string>
> = {
  verified_metadata: "verified (메타)",
  partial: "부분",
  failed: "실패",
};

export const RUNTIME_GOVERNANCE_RELEASE_READINESS_ALIGNMENT_STATUS_LABEL_KO: Readonly<
  Record<RuntimeGovernanceReleaseReadinessAlignmentStatus, string>
> = {
  aligned_metadata: "aligned (메타)",
  partial: "부분",
  failed: "실패",
};

export const RUNTIME_GOVERNANCE_RELEASE_READINESS_EMPTY_HINT_KO = {
  boundary: "readiness boundary 행 없음",
  forbiddenOperation: "금지 boundary operation 없음",
  inputEnvelope: "input envelope 행 없음",
  outputEnvelope: "output envelope 행 없음",
  noEnforcementProof: "no-enforcement proof 행 없음",
  forbiddenProof: "forbidden proof 행 없음",
  checklist: "readiness checklist 행 없음",
  missingChecklist: "누락 checklist 항목 없음",
  blocker: "release-readiness blocker 없음",
  recommendation: "recommendation 없음",
  boundaryViolation: "release-readiness violation 없음",
  readinessFinding: "readiness verification finding 없음",
  alignmentFinding: "alignment finding 없음",
  finalGateChecklist: "final gate checklist 행 없음",
} as const;
