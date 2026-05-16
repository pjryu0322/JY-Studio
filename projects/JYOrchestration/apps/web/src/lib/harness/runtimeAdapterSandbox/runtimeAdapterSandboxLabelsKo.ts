/**
 * H26 / H26.5 — Overlay·진단용 한국어 라벨(read-only).
 */

import type {
  RuntimeAdapterSandboxMode,
  RuntimeAdapterSandboxPreflightReadiness,
  RuntimeAdapterSandboxReadiness,
} from "./runtimeAdapterSandboxTypes";

export const RUNTIME_ADAPTER_SANDBOX_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 sandbox adapter 호출이 아니라, adapter sandbox readiness와 입력/출력 envelope를 설명하는 read-only metadata입니다.";

export const RUNTIME_ADAPTER_SANDBOX_READINESS_LABEL_KO: Record<RuntimeAdapterSandboxReadiness, string> = {
  not_ready: "sandbox 미준비",
  sandbox_metadata_ready: "sandbox 메타 준비(H27 전)",
  watch: "sandbox 주시",
  blocked: "sandbox 차단",
};

export const RUNTIME_ADAPTER_SANDBOX_MODE_LABEL_KO: Record<RuntimeAdapterSandboxMode, string> = {
  disabled: "sandbox 비활성(메타만)",
  metadata_only: "sandbox metadata only(호출 없음)",
  blocked: "sandbox 차단",
};

export const RUNTIME_ADAPTER_SANDBOX_PREFLIGHT_READINESS_LABEL_KO: Record<
  RuntimeAdapterSandboxPreflightReadiness,
  string
> = {
  ready_metadata: "sandbox preflight 메타 준비(H27 전)",
  watch: "sandbox preflight 주시",
  blocked: "sandbox preflight 차단",
  not_ready: "sandbox preflight 미준비",
};

const ENVELOPE_VERIFICATION_STATUS_LABEL_KO: Record<string, string> = {
  verified_metadata: "envelope 검증 완료(메타)",
  partial: "envelope 검증 부분",
  failed: "envelope 검증 실패",
};

export function runtimeAdapterSandboxEnvelopeVerificationStatusKo(status: string): string {
  return ENVELOPE_VERIFICATION_STATUS_LABEL_KO[status] ?? status;
}

export const RUNTIME_ADAPTER_SANDBOX_OVERLAY_FOOTER_KO =
  "actual sandbox invocation·adapter invocation·execution·routing·queue control·rollback·prompt 변경은 없습니다.";

export const RUNTIME_ADAPTER_SANDBOX_EMPTY_HINT_KO = {
  inputEnvelope: "Input envelope 없음",
  outputEnvelope: "Output envelope 없음",
  forbiddenOperation: "Forbidden sandbox operation 없음",
  sandboxResult: "Sandbox result 없음",
  envelopeFinding: "Envelope finding 없음",
  boundaryViolation: "Boundary violation 없음",
  preflightChecklist: "Preflight checklist 없음",
  recommendation: "Recommendation 없음",
} as const;
