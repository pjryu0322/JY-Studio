/**
 * H35 — release-gate final preflight overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeReleaseGatePreflightMode,
  RuntimeReleaseGatePreflightReadiness,
} from "./runtimeReleaseGatePreflightTypes";

export const RUNTIME_RELEASE_GATE_PREFLIGHT_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 release enforcement나 shell execution이 아니라, controlled release-gate final preflight·execution readiness boundary를 설명하는 read-only metadata입니다.";

export const RUNTIME_RELEASE_GATE_PREFLIGHT_OVERLAY_FOOTER_KO =
  "actual release enforcement·no-op shell execution·execution shell execution·runtime adapter invocation·execution·routing·queue control·rollback·prompt 변경은 없습니다.";

export const RUNTIME_RELEASE_GATE_PREFLIGHT_READINESS_LABEL_KO: Readonly<
  Record<RuntimeReleaseGatePreflightReadiness, string>
> = {
  not_ready: "미준비",
  preflight_metadata_ready: "preflight 메타 준비됨",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_RELEASE_GATE_PREFLIGHT_MODE_LABEL_KO: Readonly<
  Record<RuntimeReleaseGatePreflightMode, string>
> = {
  disabled: "비활성(메타)",
  metadata_only: "메타만",
  blocked: "차단",
};

export const RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO = {
  inputEnvelope: "input envelope 행 없음",
  outputEnvelope: "output envelope 행 없음",
  forbiddenOperation: "금지 boundary operation 없음",
  proof: "proof 행 없음",
  checklist: "preflight checklist 행 없음",
  missingChecklist: "누락 checklist 항목 없음",
  blocker: "preflight blocker 없음",
  recommendation: "recommendation 없음",
} as const;
