/**
 * H31 — no-op execution shell overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeNoopExecutionShellCandidateStatus,
  RuntimeNoopExecutionShellFinalGateStatus,
  RuntimeNoopExecutionShellMode,
} from "./runtimeNoopExecutionShellTypes";

export const RUNTIME_NOOP_EXECUTION_SHELL_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 execution shell 실행이 아니라, isolated dry-run no-op execution shell 후보를 설명하는 read-only metadata입니다.";

export const RUNTIME_NOOP_EXECUTION_SHELL_OVERLAY_FOOTER_KO =
  "actual no-op shell execution·execution shell execution·runner invocation·runner execution·runtime adapter invocation·execution·routing·queue control·rollback·prompt 변경은 없습니다.";

export const RUNTIME_NOOP_EXECUTION_SHELL_CANDIDATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeNoopExecutionShellCandidateStatus, string>
> = {
  not_candidate: "미후보",
  shell_metadata_candidate: "shell 메타 후보",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_NOOP_EXECUTION_SHELL_MODE_LABEL_KO: Readonly<Record<RuntimeNoopExecutionShellMode, string>> = {
  disabled: "비활성(메타)",
  metadata_only: "메타데이터만",
  blocked: "차단",
};

export const RUNTIME_NOOP_EXECUTION_SHELL_FINAL_GATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeNoopExecutionShellFinalGateStatus, string>
> = {
  ready_metadata: "메타 준비",
  watch: "주시",
  blocked: "차단",
  not_ready: "미준비",
};

export function runtimeNoopExecutionShellReadinessVerificationStatusKo(status: string): string {
  switch (status) {
    case "verified_metadata":
      return "검증됨(메타)";
    case "partial":
      return "부분";
    case "failed":
      return "실패";
    default:
      return status;
  }
}

export const RUNTIME_NOOP_EXECUTION_SHELL_EMPTY_HINT_KO = {
  scope: "shell scope 없음",
  forbiddenOperation: "금지 shell operation 없음",
  checklist: "readiness checklist 없음",
  missingRow: "누락 checklist 항목 없음",
  blocker: "shell blocker 없음",
  recommendation: "권고 없음",
  boundaryViolation: "boundary violation 없음",
  readinessFinding: "readiness finding 없음",
  finalGateChecklist: "final gate checklist 없음",
} as const;
