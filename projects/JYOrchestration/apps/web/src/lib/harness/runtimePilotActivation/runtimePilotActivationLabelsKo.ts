/**
 * H27 — pilot activation overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimePilotActivationCandidateStatus,
  RuntimePilotActivationMode,
} from "./runtimePilotActivationTypes";

export const RUNTIME_PILOT_ACTIVATION_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 pilot activation이 아니라, controlled runtime pilot 후보를 설명하는 read-only activation candidate metadata입니다.";

export const RUNTIME_PILOT_ACTIVATION_OVERLAY_FOOTER_KO =
  "actual pilot activation·runtime adapter invocation·sandbox invocation·execution·routing·queue control·rollback·prompt 변경은 없습니다.";

export const RUNTIME_PILOT_ACTIVATION_CANDIDATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimePilotActivationCandidateStatus, string>
> = {
  not_candidate: "미후보",
  activation_metadata_candidate: "activation 메타 후보",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_PILOT_ACTIVATION_MODE_LABEL_KO: Readonly<Record<RuntimePilotActivationMode, string>> = {
  disabled: "비활성(메타)",
  metadata_only: "메타데이터만",
  blocked: "차단",
};

export const RUNTIME_PILOT_ACTIVATION_EMPTY_HINT_KO = {
  scope: "activation scope 없음",
  forbiddenOperation: "금지 operation 없음",
  checklist: "readiness checklist 없음",
  blocker: "activation blocker 없음",
  recommendation: "권고 없음",
} as const;
