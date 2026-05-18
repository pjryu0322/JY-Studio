/**
 * Pilot Validation Phase 2 — Safe Echo contract status resolution (read-only).
 */

import type { RuntimePilotValidationReadOnlyChainSummary } from "./runtimePilotValidationTypes";
import type {
  RuntimeSafeEchoAdapterContractStatus,
  RuntimeSafeEchoAdapterMode,
} from "./runtimeSafeEchoAdapterContractTypes";

export function resolveRuntimeSafeEchoAdapterContractStatus(input: Readonly<{
  summary: RuntimePilotValidationReadOnlyChainSummary;
  finalGateStatus: string;
}>): RuntimeSafeEchoAdapterContractStatus {
  const { summary, finalGateStatus } = input;

  if (
    summary.validationStatus === "blocked" ||
    finalGateStatus === "blocked" ||
    summary.topBlockers.length > 0
  ) {
    return "blocked";
  }

  if (summary.validationStatus === "watch" || finalGateStatus === "watch") {
    return "watch";
  }

  if (
    summary.validationStatus === "ready_for_validation" &&
    finalGateStatus === "ready_metadata" &&
    summary.pilotValidationEntryReadiness === "ready_metadata"
  ) {
    return "contract_ready";
  }

  return "not_ready";
}

export function resolveRuntimeSafeEchoAdapterMode(
  contractStatus: RuntimeSafeEchoAdapterContractStatus
): RuntimeSafeEchoAdapterMode {
  switch (contractStatus) {
    case "contract_ready":
      return "sandbox_dry_run_contract";
    case "blocked":
      return "blocked";
    default:
      return "contract_only";
  }
}
