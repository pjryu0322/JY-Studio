/**
 * H33 — no-op shell hardening overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeNoopShellHardeningAlignmentStatus,
  RuntimeNoopShellHardeningContractVerificationStatus,
  RuntimeNoopShellHardeningFinalGateStatus,
  RuntimeNoopShellHardeningMode,
  RuntimeNoopShellHardeningPreflightReadiness,
  RuntimeNoopShellHardeningReadiness,
  RuntimeNoopShellHardeningReadinessVerificationStatus,
} from "./runtimeNoopShellHardeningTypes";

export const RUNTIME_NOOP_SHELL_HARDENING_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 no-op shell execution이 아니라, no-op execution shell hardening과 shell contract verification을 설명하는 read-only metadata입니다.";

export const RUNTIME_NOOP_SHELL_HARDENING_OVERLAY_FOOTER_KO =
  "actual no-op shell execution·execution shell execution·runtime adapter invocation·execution·routing·queue control·rollback·prompt 변경은 없습니다.";

export const RUNTIME_NOOP_SHELL_HARDENING_READINESS_LABEL_KO: Readonly<
  Record<RuntimeNoopShellHardeningReadiness, string>
> = {
  not_ready: "미준비",
  hardening_metadata_ready: "hardening 메타 준비",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_NOOP_SHELL_HARDENING_MODE_LABEL_KO: Readonly<Record<RuntimeNoopShellHardeningMode, string>> = {
  disabled: "비활성(메타)",
  contract_verification_only: "계약 검증만",
  blocked: "차단",
};

export const RUNTIME_NOOP_SHELL_HARDENING_PREFLIGHT_READINESS_LABEL_KO: Readonly<
  Record<RuntimeNoopShellHardeningPreflightReadiness, string>
> = {
  not_ready: "미준비",
  ready_metadata: "메타 준비",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_NOOP_SHELL_HARDENING_CONTRACT_VERIFICATION_STATUS_LABEL_KO: Readonly<
  Record<RuntimeNoopShellHardeningContractVerificationStatus, string>
> = {
  verified_metadata: "검증됨(메타)",
  partial: "부분",
  failed: "실패",
};

export const RUNTIME_NOOP_SHELL_HARDENING_FINAL_GATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimeNoopShellHardeningFinalGateStatus, string>
> = {
  ready_metadata: "메타 준비",
  watch: "주시",
  blocked: "차단",
  not_ready: "미준비",
};

export function runtimeNoopShellHardeningReadinessVerificationStatusKo(
  status: RuntimeNoopShellHardeningReadinessVerificationStatus
): string {
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

export const RUNTIME_NOOP_SHELL_HARDENING_ALIGNMENT_STATUS_LABEL_KO: Readonly<
  Record<RuntimeNoopShellHardeningAlignmentStatus, string>
> = {
  aligned_metadata: "정렬됨(메타)",
  partial: "부분",
  failed: "실패",
};

export const RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO = {
  contract: "shell hardening contract 행 없음",
  contractFinding: "contract verification finding 없음",
  inputEnvelope: "input envelope 행 없음",
  outputEnvelope: "output envelope 행 없음",
  guard: "safety guard 행 없음",
  boundaryViolation: "boundary violation 없음",
  blocker: "hardening blocker 없음",
  preflightChecklist: "preflight checklist 행 없음",
  readinessFinding: "readiness finding 없음",
  alignmentFinding: "alignment finding 없음",
  finalGateChecklist: "final gate checklist 행 없음",
  recommendation: "recommendation 없음",
} as const;
