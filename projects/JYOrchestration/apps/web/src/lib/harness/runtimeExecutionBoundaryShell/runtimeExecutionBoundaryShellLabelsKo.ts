/**
 * H36 — execution boundary shell overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeExecutionBoundaryShellAlignmentStatus,
  RuntimeExecutionBoundaryShellCandidateStatus,
  RuntimeExecutionBoundaryShellFinalGateStatus,
  RuntimeExecutionBoundaryShellMode,
  RuntimeExecutionBoundaryShellReadinessVerificationStatus,
} from "./runtimeExecutionBoundaryShellTypes";

export const RUNTIME_EXECUTION_BOUNDARY_SHELL_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 execution이 아니라, execution boundary metadata shell 후보를 설명하는 read-only metadata입니다.";

export const RUNTIME_EXECUTION_BOUNDARY_SHELL_OVERLAY_FOOTER_KO =
  "actual execution·execution routing·release enforcement·shell execution·runtime adapter invocation·routing·queue control·rollback·prompt 변경은 없습니다.";

export const RUNTIME_EXECUTION_BOUNDARY_SHELL_CANDIDATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeExecutionBoundaryShellCandidateStatus, string>
> = {
  not_candidate: "미후보",
  boundary_shell_metadata_candidate: "boundary shell 메타 후보",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_EXECUTION_BOUNDARY_SHELL_MODE_LABEL_KO: Readonly<
  Record<RuntimeExecutionBoundaryShellMode, string>
> = {
  disabled: "비활성(메타)",
  metadata_only: "메타만",
  blocked: "차단",
};

export const RUNTIME_EXECUTION_BOUNDARY_SHELL_FINAL_GATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeExecutionBoundaryShellFinalGateStatus, string>
> = {
  ready_metadata: "ready(메타)",
  watch: "주시",
  blocked: "차단",
  not_ready: "미준비",
};

export const RUNTIME_EXECUTION_BOUNDARY_SHELL_READINESS_VERIFICATION_STATUS_LABEL_KO: Readonly<
  Record<RuntimeExecutionBoundaryShellReadinessVerificationStatus, string>
> = {
  verified_metadata: "verified(메타)",
  partial: "부분",
  failed: "실패",
};

export const RUNTIME_EXECUTION_BOUNDARY_SHELL_ALIGNMENT_STATUS_LABEL_KO: Readonly<
  Record<RuntimeExecutionBoundaryShellAlignmentStatus, string>
> = {
  aligned_metadata: "aligned(메타)",
  partial: "부분",
  failed: "실패",
};

export const RUNTIME_EXECUTION_BOUNDARY_SHELL_EMPTY_HINT_KO = {
  scope: "shell scope 행 없음",
  forbiddenOperation: "금지 shell operation 없음",
  checklist: "readiness checklist 행 없음",
  missingChecklist: "누락 checklist 항목 없음",
  blocker: "shell blocker 없음",
  recommendation: "recommendation 없음",
  boundaryViolation: "boundary violation 없음",
  readinessFinding: "readiness finding 없음",
  alignmentFinding: "alignment finding 없음",
  finalGateChecklist: "final gate checklist 행 없음",
} as const;
