/**
 * H25 / H25.5 — Overlay·진단용 한국어 라벨(read-only).
 */

import type {
  RuntimeNoopAdapterInvocationGuard,
  RuntimeNoopAdapterPreflightReadiness,
  RuntimeNoopAdapterStatus,
} from "./runtimeNoopAdapterTypes";

export const RUNTIME_NOOP_ADAPTER_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 runtime adapter 호출이 아니라, adapter contract를 검증하기 위한 no-op skeleton metadata입니다.";

export const RUNTIME_NOOP_ADAPTER_STATUS_LABEL_KO: Record<RuntimeNoopAdapterStatus, string> = {
  not_available: "no-op adapter 미가용",
  contract_verified_noop: "contract 검증 no-op(호출 없음)",
  watch: "no-op adapter 주시(호출 없음)",
  blocked: "no-op adapter 차단(호출 없음)",
};

export const RUNTIME_NOOP_ADAPTER_INVOCATION_GUARD_LABEL_KO: Record<RuntimeNoopAdapterInvocationGuard, string> = {
  always_blocked: "adapter invocation 항상 차단",
  noop_only: "no-op only(실제 호출 없음)",
  contract_metadata_only: "contract 메타만(실제 호출 없음)",
};

export const RUNTIME_NOOP_ADAPTER_PREFLIGHT_READINESS_LABEL_KO: Record<
  RuntimeNoopAdapterPreflightReadiness,
  string
> = {
  ready_metadata: "preflight 메타 준비(H26 전)",
  watch: "preflight 주시",
  blocked: "preflight 차단",
  not_ready: "preflight 미준비",
};

export const RUNTIME_NOOP_ADAPTER_OVERLAY_FOOTER_KO =
  "actual runtime adapter invocation·execution·routing·rollback·prompt 변경은 없습니다.";

export const RUNTIME_NOOP_ADAPTER_EMPTY_HINT_KO = {
  noopResult: "No-op result 없음",
  skeletonInput: "Skeleton input 없음",
  boundaryViolation: "Boundary violation 없음",
  forbiddenOperation: "Forbidden operation 없음",
  recommendation: "Recommendation 없음",
} as const;
