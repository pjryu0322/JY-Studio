/**
 * H43 — limited pilot readiness review overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeLimitedPilotReadinessReviewMode,
  RuntimeLimitedPilotReadinessReviewStatus,
} from "./runtimeLimitedPilotReadinessReviewTypes";

export const RUNTIME_LIMITED_PILOT_READINESS_REVIEW_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 pilot activation/execution이 아니라, limited runtime pilot readiness review와 pilot contract hardening boundary를 설명하는 read-only metadata입니다.";

export const RUNTIME_LIMITED_PILOT_READINESS_REVIEW_OVERLAY_FOOTER_KO =
  "actual pilot activation·pilot execution·runner invocation·adapter invocation·sandbox invocation·execution·routing·queue control·rollback·release/approval enforcement·blocking·prompt 변경은 없습니다.";

export const RUNTIME_LIMITED_PILOT_READINESS_REVIEW_STATUS_LABEL_KO: Readonly<
  Record<RuntimeLimitedPilotReadinessReviewStatus, string>
> = {
  not_ready: "미준비",
  limited_pilot_readiness_metadata_ready: "limited pilot readiness 메타 준비",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_LIMITED_PILOT_READINESS_REVIEW_MODE_LABEL_KO: Readonly<
  Record<RuntimeLimitedPilotReadinessReviewMode, string>
> = {
  disabled: "비활성(메타)",
  metadata_only: "메타만",
  blocked: "차단",
};

export const RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO = {
  contractBoundary: "pilot contract hardening boundary 행이 없습니다.",
  inputEnvelope: "pilot readiness input envelope 행이 없습니다.",
  outputEnvelope: "pilot readiness output envelope 행이 없습니다.",
  noExecutionProof: "pilot no-execution proof 행이 없습니다.",
  forbiddenProof: "pilot execution-forbidden proof 행이 없습니다.",
  checklist: "pilot contract readiness checklist 행이 없습니다.",
  missingChecklist: "누락 checklist 행이 없습니다.",
  blocker: "pilot readiness blocker가 없습니다.",
  recommendation: "권장 사항이 없습니다.",
} as const;
