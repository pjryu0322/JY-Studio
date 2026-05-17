/**
 * H41 — controlled activation candidate overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeControlledActivationCandidateStatus,
  RuntimeControlledActivationMode,
} from "./runtimeControlledActivationCandidateTypes";

export const RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 activation/orchestration/execution이 아니라, controlled activation candidate와 runtime control handoff boundary를 설명하는 read-only metadata입니다.";

export const RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_OVERLAY_FOOTER_KO =
  "actual orchestration·activation·execution·execution routing·release enforcement·approval enforcement·execution blocking·merge blocking·routing·queue control·rollback·prompt 변경은 없습니다.";

export const RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeControlledActivationCandidateStatus, string>
> = {
  not_candidate: "미후보",
  controlled_activation_metadata_candidate: "controlled activation 메타 후보",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_CONTROLLED_ACTIVATION_MODE_LABEL_KO: Readonly<
  Record<RuntimeControlledActivationMode, string>
> = {
  disabled: "비활성(메타)",
  metadata_only: "메타만",
  blocked: "차단",
};

export const RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_EMPTY_HINT_KO = {
  handoffBoundary: "control handoff boundary 행이 없습니다.",
  candidateScope: "activation candidate scope 행이 없습니다.",
  forbiddenOperation: "금지 activation operation이 없습니다.",
  checklist: "activation readiness checklist 행이 없습니다.",
  missingChecklist: "누락 checklist 행이 없습니다.",
  blocker: "activation blocker가 없습니다.",
  recommendation: "권장 사항이 없습니다.",
} as const;
