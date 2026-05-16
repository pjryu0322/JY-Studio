/**
 * H27 / H27.5 — pilot activation overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimePilotActivationCandidateStatus,
  RuntimePilotActivationFinalGateStatus,
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

export const RUNTIME_PILOT_ACTIVATION_FINAL_GATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimePilotActivationFinalGateStatus, string>
> = {
  ready_metadata: "메타 준비",
  watch: "주시",
  blocked: "차단",
  not_ready: "미준비",
};

export function runtimePilotActivationReadinessVerificationStatusKo(status: string): string {
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

export const RUNTIME_PILOT_ACTIVATION_EMPTY_HINT_KO = {
  scope: "activation scope 없음",
  forbiddenOperation: "금지 operation 없음",
  checklist: "readiness checklist 없음",
  blocker: "activation blocker 없음",
  boundaryViolation: "boundary violation 없음",
  readinessFinding: "readiness finding 없음",
  finalGateChecklist: "final gate checklist 없음",
  recommendation: "권고 없음",
} as const;
