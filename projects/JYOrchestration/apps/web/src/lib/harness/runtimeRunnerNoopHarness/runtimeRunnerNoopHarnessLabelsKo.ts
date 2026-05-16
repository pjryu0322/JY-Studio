/**
 * H30 — runner no-op harness overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeRunnerNoopHarnessContractVerificationStatus,
  RuntimeRunnerNoopHarnessMode,
  RuntimeRunnerNoopHarnessPreflightReadiness,
  RuntimeRunnerNoopHarnessReadiness,
} from "./runtimeRunnerNoopHarnessTypes";

export const RUNTIME_RUNNER_NOOP_HARNESS_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 isolated runner invocation이 아니라, isolated dry-run runner no-op harness와 invocation contract를 설명하는 read-only metadata입니다.";

export const RUNTIME_RUNNER_NOOP_HARNESS_OVERLAY_FOOTER_KO =
  "actual isolated runner invocation·isolated runner execution·dry-run runner invocation·dry-run runner execution·runtime adapter invocation·execution·routing·queue control·rollback·prompt 변경은 없습니다.";

export const RUNTIME_RUNNER_NOOP_HARNESS_READINESS_LABEL_KO: Readonly<
  Record<RuntimeRunnerNoopHarnessReadiness, string>
> = {
  not_ready: "미준비",
  noop_harness_metadata_ready: "no-op harness 메타 준비",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_RUNNER_NOOP_HARNESS_MODE_LABEL_KO: Readonly<Record<RuntimeRunnerNoopHarnessMode, string>> = {
  disabled: "비활성(메타)",
  noop_contract_only: "no-op contract만",
  blocked: "차단",
};

export const RUNTIME_RUNNER_NOOP_HARNESS_PREFLIGHT_READINESS_LABEL_KO: Readonly<
  Record<RuntimeRunnerNoopHarnessPreflightReadiness, string>
> = {
  not_ready: "미준비",
  ready_metadata: "메타 준비",
  watch: "주시",
  blocked: "차단",
};

export function runtimeRunnerNoopHarnessContractVerificationStatusKo(status: string): string {
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

export const RUNTIME_RUNNER_NOOP_HARNESS_EMPTY_HINT_KO = {
  envelope: "invocation envelope 없음",
  result: "noop result 없음",
  guard: "safety guard 없음",
  boundaryViolation: "boundary violation 없음",
  readinessFinding: "contract finding 없음",
  preflightChecklist: "preflight checklist 없음",
  blocker: "harness blocker 없음",
  recommendation: "권고 없음",
} as const;
