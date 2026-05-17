/**
 * H45 — controlled pilot execution candidate overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeControlledPilotExecutionCandidateStatus,
  RuntimeControlledPilotExecutionMode,
} from "./runtimeControlledPilotExecutionCandidateTypes";

export const RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 pilot execution이 아니라, controlled pilot execution candidate와 final runtime handoff boundary를 설명하는 read-only metadata입니다.";

export const RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_OVERLAY_FOOTER_KO =
  "actual pilot activation·pilot execution·runner invocation·adapter invocation·sandbox invocation·execution·routing·queue control·rollback·release/approval enforcement·blocking·prompt 변경은 없습니다.";

export const RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeControlledPilotExecutionCandidateStatus, string>
> = {
  not_candidate: "미후보",
  controlled_pilot_execution_metadata_candidate: "controlled pilot execution 메타 후보",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_CONTROLLED_PILOT_EXECUTION_MODE_LABEL_KO: Readonly<
  Record<RuntimeControlledPilotExecutionMode, string>
> = {
  disabled: "비활성(메타)",
  metadata_only: "메타만",
  blocked: "차단",
};

export const RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_EMPTY_HINT_KO = {
  handoffBoundary: "handoff boundary 메타 없음",
  candidateScope: "candidate scope 메타 없음",
  forbiddenOperation: "금지 operation 없음",
  inputContract: "input contract 메타 없음",
  outputContract: "output contract 메타 없음",
  checklist: "readiness checklist 없음",
  missingChecklist: "누락 checklist 없음",
  blocker: "blocker 없음",
  recommendation: "recommendation 없음",
} as const;
