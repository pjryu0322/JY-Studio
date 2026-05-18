/**
 * H28 — pilot skeleton overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimePilotRunnerContractVerificationStatus,
  RuntimePilotRunnerMode,
  RuntimePilotSkeletonPreflightReadiness,
  RuntimePilotSkeletonReadiness,
} from "./runtimePilotSkeletonTypes";

export const RUNTIME_PILOT_SKELETON_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 isolated runner 실행이 아니라, controlled runtime pilot skeleton과 dry-run runner contract를 설명하는 read-only metadata입니다.";

export const RUNTIME_PILOT_SKELETON_OVERLAY_FOOTER_KO =
  "actual isolated runner execution·dry-run runner execution·pilot execution·runtime adapter invocation·execution·routing·queue control·rollback·prompt 변경은 없습니다.";

export const RUNTIME_PILOT_SKELETON_READINESS_LABEL_KO: Readonly<Record<RuntimePilotSkeletonReadiness, string>> = {
  not_ready: "미준비",
  skeleton_metadata_ready: "skeleton 메타 준비",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_PILOT_RUNNER_MODE_LABEL_KO: Readonly<Record<RuntimePilotRunnerMode, string>> = {
  disabled: "비활성(메타)",
  dry_run_contract_only: "dry-run contract만",
  blocked: "차단",
};

export const RUNTIME_PILOT_RUNNER_CONTRACT_VERIFICATION_STATUS_LABEL_KO: Readonly<
  Record<RuntimePilotRunnerContractVerificationStatus, string>
> = {
  verified_metadata: "검증됨(메타)",
  partial: "부분",
  failed: "실패",
};

export const RUNTIME_PILOT_SKELETON_PREFLIGHT_READINESS_LABEL_KO: Readonly<
  Record<RuntimePilotSkeletonPreflightReadiness, string>
> = {
  ready_metadata: "preflight 준비(메타)",
  watch: "preflight 주시",
  blocked: "preflight 차단",
  not_ready: "preflight 미준비",
};

export function runtimePilotRunnerContractVerificationStatusKo(
  status: RuntimePilotRunnerContractVerificationStatus
): string {
  return RUNTIME_PILOT_RUNNER_CONTRACT_VERIFICATION_STATUS_LABEL_KO[status];
}

export const RUNTIME_PILOT_SKELETON_EMPTY_HINT_KO = {
  contract: "runner contract 없음",
  inputEnvelope: "input envelope 없음",
  outputEnvelope: "output envelope 없음",
  forbiddenOperation: "금지 operation 없음",
  safetyGuard: "safety guard 없음",
  blocker: "skeleton blocker 없음",
  recommendation: "권고 없음",
  contractFinding: "contract 검증 finding 없음",
  boundaryViolation: "boundary violation 없음",
  noExecutionResult: "no-execution result 없음",
  preflightChecklist: "preflight checklist 없음",
} as const;
