/**
 * H34 / H34.5 — no-op shell release-gate overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeNoopShellReleaseGateAlignmentStatus,
  RuntimeNoopShellReleaseGateCandidateStatus,
  RuntimeNoopShellReleaseGateFinalGateStatus,
  RuntimeNoopShellReleaseGateMode,
  RuntimeNoopShellReleaseGateReadinessVerificationStatus,
} from "./runtimeNoopShellReleaseGateTypes";

export const RUNTIME_NOOP_SHELL_RELEASE_GATE_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 release enforcement나 shell execution이 아니라, controlled no-op execution shell release-gate 후보를 설명하는 read-only metadata입니다.";

export const RUNTIME_NOOP_SHELL_RELEASE_GATE_OVERLAY_FOOTER_KO =
  "actual release enforcement·no-op shell execution·execution shell execution·runtime adapter invocation·execution·routing·queue control·rollback·prompt 변경은 없습니다.";

export const RUNTIME_NOOP_SHELL_RELEASE_GATE_CANDIDATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeNoopShellReleaseGateCandidateStatus, string>
> = {
  not_candidate: "미후보",
  release_gate_metadata_candidate: "release-gate 메타 후보",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_NOOP_SHELL_RELEASE_GATE_MODE_LABEL_KO: Readonly<
  Record<RuntimeNoopShellReleaseGateMode, string>
> = {
  disabled: "비활성(메타)",
  metadata_only: "메타만",
  blocked: "차단",
};

export const RUNTIME_NOOP_SHELL_RELEASE_GATE_EMPTY_HINT_KO = {
  scope: "release-gate scope 행 없음",
  forbiddenOperation: "금지 release-gate operation 없음",
  checklist: "readiness checklist 행 없음",
  missingChecklist: "누락 checklist 항목 없음",
  blocker: "release-gate blocker 없음",
  recommendation: "recommendation 없음",
  boundaryViolation: "boundary violation 없음",
  readinessFinding: "readiness verification finding 없음",
  alignmentFinding: "alignment finding 없음",
  finalGateChecklist: "final gate checklist 행 없음",
} as const;

export const RUNTIME_NOOP_SHELL_RELEASE_GATE_FINAL_GATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeNoopShellReleaseGateFinalGateStatus, string>
> = {
  ready_metadata: "메타 준비됨",
  watch: "주시",
  blocked: "차단",
  not_ready: "미준비",
};

export const RUNTIME_NOOP_SHELL_RELEASE_GATE_READINESS_VERIFICATION_STATUS_LABEL_KO: Readonly<
  Record<RuntimeNoopShellReleaseGateReadinessVerificationStatus, string>
> = {
  verified_metadata: "검증됨(메타)",
  partial: "부분",
  failed: "실패",
};

export const RUNTIME_NOOP_SHELL_RELEASE_GATE_ALIGNMENT_STATUS_LABEL_KO: Readonly<
  Record<RuntimeNoopShellReleaseGateAlignmentStatus, string>
> = {
  aligned_metadata: "정렬됨(메타)",
  partial: "부분",
  failed: "실패",
};
