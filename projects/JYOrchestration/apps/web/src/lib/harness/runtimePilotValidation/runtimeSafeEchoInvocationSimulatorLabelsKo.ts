/**
 * Pilot Validation Phase 4 — simulator user-facing labels (no execution wording).
 */

import type {
  RuntimeSafeEchoInvocationSimulatorMode,
  RuntimeSafeEchoInvocationSimulatorStatus,
} from "./runtimeSafeEchoInvocationSimulatorTypes";

export const RUNTIME_SAFE_ECHO_INVOCATION_SIMULATOR_STATUS_LABEL_KO: Readonly<
  Record<RuntimeSafeEchoInvocationSimulatorStatus, string>
> = {
  simulator_contract_ready: "시뮬레이터 계약 준비됨",
  watch: "시뮬레이터 계약 주의 확인 필요",
  blocked: "시뮬레이터 계약 차단",
  not_ready: "시뮬레이터 계약 준비되지 않음",
};

export const RUNTIME_SAFE_ECHO_INVOCATION_SIMULATOR_MODE_LABEL_KO: Readonly<
  Record<RuntimeSafeEchoInvocationSimulatorMode, string>
> = {
  simulator_contract_only: "Simulator contract only",
  read_only_echo_simulation_contract: "읽기 전용 Echo Simulation 계약",
  blocked: "차단됨",
};

export const PILOT_VALIDATION_SIMULATOR_NO_INVOCATION_NOTICE_KO =
  "실제 Adapter/Sandbox/Runner 호출 없음. 시뮬레이션 output은 expected metadata contract이며 실제 실행 결과가 아닙니다.";
