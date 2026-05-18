/**
 * Pilot Validation Phase 0 — Overlay read-only chain validation section VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_FINAL_GATE_STATUS_LABEL_KO,
} from "@/lib/harness/runtimeControlledPilotExecutionCandidate/runtimeControlledPilotExecutionCandidateLabelsKo";
import {
  RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_SECTION_DISCLAIMER_KO,
  RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_STATUS_LABEL_KO,
} from "@/lib/harness/runtimePilotValidation/runtimePilotValidationLabelsKo";
import {
  RUNTIME_SAFE_ECHO_ADAPTER_CONTRACT_STATUS_LABEL_KO,
  RUNTIME_SAFE_ECHO_ADAPTER_MODE_LABEL_KO,
} from "@/lib/harness/runtimePilotValidation/runtimeSafeEchoAdapterContractLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";
import { buildPilotValidationUserSummaryVmFromReports } from "./pilotValidationUserSummaryVm";
import type { PilotValidationUserSummaryVm } from "./pilotValidationUserSummaryVm";

export type OverlayRuntimePilotValidationReadOnlyChainSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  validationStatusKo: string;
  finalGateStatusKo: string;
  pilotValidationEntryReadinessKo: string;
  topBlocker: string | null;
  topWarning: string | null;
  userVisibleSummaryKo: string;
  operatorVisibleSummaryKo: string;
  finalProofSummaryRows: readonly string[];
  recommendationRows: readonly string[];
  userSummaryVm: PilotValidationUserSummaryVm;
  safeEchoContractStatusKo: string;
  safeEchoAdapterModeKo: string;
  sandboxBoundaryTopForbiddenKo: string | null;
  safeEchoInputContractSummaryKo: string;
  safeEchoOutputContractSummaryKo: string;
}>;

export function buildOverlayRuntimePilotValidationReadOnlyChainSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimePilotValidationReadOnlyChainSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const summary = reports.runtimePilotValidationReadOnlyChainSummary;
  const finalGate = reports.runtimeControlledPilotExecutionCandidateFinalSafetyGate;
  const userSummaryVm = buildPilotValidationUserSummaryVmFromReports(reports);
  const safeEcho = reports.runtimeSafeEchoAdapterContractSummary;
  const boundary = reports.runtimeSandboxDryRunBoundary;
  const inputContract = reports.runtimeSafeEchoAdapterInputContract;
  const outputContract = reports.runtimeSafeEchoAdapterOutputContract;

  const showAttention =
    summary.validationStatus === "watch" ||
    summary.validationStatus === "blocked" ||
    summary.validationStatus === "not_ready";

  const topBlocker = summary.topBlockers[0] ?? null;
  const topWarning = summary.topWarnings[0] ?? null;

  return {
    sectionDisclaimer: RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_SECTION_DISCLAIMER_KO,
    showAttention,
    showDetailSections: !compactAndNarrowUi,
    validationStatusKo: RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_STATUS_LABEL_KO[summary.validationStatus],
    finalGateStatusKo:
      RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_FINAL_GATE_STATUS_LABEL_KO[finalGate.finalGateStatus] ??
      finalGate.finalGateStatus,
    pilotValidationEntryReadinessKo:
      RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_FINAL_GATE_STATUS_LABEL_KO[
        finalGate.pilotValidationEntryReadiness
      ] ?? finalGate.pilotValidationEntryReadiness,
    topBlocker,
    topWarning,
    userVisibleSummaryKo: summary.userVisibleSummaryKo,
    operatorVisibleSummaryKo: summary.operatorVisibleSummaryKo,
    finalProofSummaryRows: sliceOverlayRows(summary.finalProofSummary, compactAndNarrowUi),
    recommendationRows: sliceOverlayRows(
      mergeSortedUniqueKo([...summary.recommendations, ...userSummaryVm.safetySummaryRows.slice(0, 1)]),
      compactAndNarrowUi
    ),
    userSummaryVm,
    safeEchoContractStatusKo: RUNTIME_SAFE_ECHO_ADAPTER_CONTRACT_STATUS_LABEL_KO[safeEcho.contractStatus],
    safeEchoAdapterModeKo: RUNTIME_SAFE_ECHO_ADAPTER_MODE_LABEL_KO[safeEcho.adapterMode],
    sandboxBoundaryTopForbiddenKo: boundary.forbiddenBoundaryOperations[0] ?? null,
    safeEchoInputContractSummaryKo: `requiredInputs:${inputContract.requiredInputs.length}; prohibited:${inputContract.prohibitedInputPayloads.length}`,
    safeEchoOutputContractSummaryKo: `expectedOutputs:${outputContract.expectedOutputs.length}; prohibited:${outputContract.prohibitedOutputs.length}`,
  };
}
