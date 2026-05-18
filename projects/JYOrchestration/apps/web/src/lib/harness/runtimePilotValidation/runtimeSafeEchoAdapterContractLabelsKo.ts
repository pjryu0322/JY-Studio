/**
 * Pilot Validation Phase 2 — Safe Echo contract Korean labels.
 */

import type {
  RuntimeSafeEchoAdapterContractStatus,
  RuntimeSafeEchoAdapterMode,
} from "./runtimeSafeEchoAdapterContractTypes";

export const RUNTIME_SAFE_ECHO_ADAPTER_CONTRACT_STATUS_LABEL_KO: Readonly<
  Record<RuntimeSafeEchoAdapterContractStatus, string>
> = {
  contract_ready: "파일럿 검증 계약 준비됨",
  watch: "계약 주의 확인 필요",
  blocked: "계약 차단",
  not_ready: "계약 준비되지 않음",
};

export const RUNTIME_SAFE_ECHO_ADAPTER_MODE_LABEL_KO: Readonly<Record<RuntimeSafeEchoAdapterMode, string>> = {
  contract_only: "Safe Echo Contract only",
  sandbox_dry_run_contract: "Sandbox dry-run contract metadata",
  blocked: "차단됨",
};
