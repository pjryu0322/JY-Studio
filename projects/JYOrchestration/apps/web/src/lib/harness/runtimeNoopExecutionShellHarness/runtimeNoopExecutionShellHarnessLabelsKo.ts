/**
 * H32 — controlled execution shell harness overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeNoopExecutionShellHarnessMode,
  RuntimeNoopExecutionShellHarnessPreflightReadiness,
  RuntimeNoopExecutionShellHarnessReadiness,
} from "./runtimeNoopExecutionShellHarnessTypes";

export const RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 execution shell 실행이 아니라, controlled no-op execution shell harness와 shell contract boundary를 설명하는 read-only metadata입니다.";

export const RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_OVERLAY_FOOTER_KO =
  "actual no-op shell execution·execution shell execution·runtime adapter invocation·execution·routing·queue control·rollback·prompt 변경은 없습니다.";

export const RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_READINESS_LABEL_KO: Readonly<
  Record<RuntimeNoopExecutionShellHarnessReadiness, string>
> = {
  not_ready: "미준비",
  shell_harness_metadata_ready: "harness 메타 준비",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_MODE_LABEL_KO: Readonly<
  Record<RuntimeNoopExecutionShellHarnessMode, string>
> = {
  disabled: "비활성(메타)",
  shell_contract_only: "shell contract만",
  blocked: "차단",
};

export const RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_PREFLIGHT_READINESS_LABEL_KO: Readonly<
  Record<RuntimeNoopExecutionShellHarnessPreflightReadiness, string>
> = {
  not_ready: "미준비",
  ready_metadata: "메타 준비",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_EMPTY_HINT_KO = {
  contractBoundary: "contract boundary 행 없음",
  inputEnvelope: "input envelope 행 없음",
  outputEnvelope: "output envelope 행 없음",
  guard: "safety guard 행 없음",
  blocker: "harness blocker 없음",
  preflightChecklist: "preflight checklist 행 없음",
  recommendation: "recommendation 없음",
} as const;
