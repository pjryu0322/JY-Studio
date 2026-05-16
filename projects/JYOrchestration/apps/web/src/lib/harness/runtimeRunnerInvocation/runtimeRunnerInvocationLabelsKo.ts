/**
 * H29 — runner invocation overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeRunnerInvocationCandidateStatus,
  RuntimeRunnerInvocationMode,
} from "./runtimeRunnerInvocationTypes";

export const RUNTIME_RUNNER_INVOCATION_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 isolated runner invocation이 아니라, isolated dry-run runner 호출 후보를 설명하는 read-only invocation candidate metadata입니다.";

export const RUNTIME_RUNNER_INVOCATION_OVERLAY_FOOTER_KO =
  "actual isolated runner invocation·isolated runner execution·dry-run runner invocation·dry-run runner execution·runtime adapter invocation·execution·routing·queue control·rollback·prompt 변경은 없습니다.";

export const RUNTIME_RUNNER_INVOCATION_CANDIDATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeRunnerInvocationCandidateStatus, string>
> = {
  not_candidate: "미후보",
  invocation_metadata_candidate: "invocation 메타 후보",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_RUNNER_INVOCATION_MODE_LABEL_KO: Readonly<Record<RuntimeRunnerInvocationMode, string>> = {
  disabled: "비활성(메타)",
  metadata_only: "메타데이터만",
  blocked: "차단",
};

export const RUNTIME_RUNNER_INVOCATION_EMPTY_HINT_KO = {
  scope: "invocation scope 없음",
  forbiddenOperation: "금지 invocation operation 없음",
  checklist: "readiness checklist 없음",
  missingRow: "누락 checklist 항목 없음",
  blocker: "invocation blocker 없음",
  recommendation: "권고 없음",
} as const;
