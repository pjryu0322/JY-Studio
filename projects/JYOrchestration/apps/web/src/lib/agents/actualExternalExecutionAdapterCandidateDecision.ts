/**
 * Stage 13-A adapter candidate decision (read-only).
 */

import type {
  ActualExternalExecutionAdapterCandidateDecision,
  ActualExternalExecutionAdapterCandidateDecisionInput,
  ActualExternalExecutionAdapterCandidateInput,
  ParsedActualExternalExecutionAdapterCandidateInput,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";

export function parseActualExternalExecutionAdapterCandidateInput(
  input?: ActualExternalExecutionAdapterCandidateInput,
): ParsedActualExternalExecutionAdapterCandidateInput {
  const flags = [
    input?.cursorAdapterCandidateReviewed === true,
    input?.githubAdapterCandidateReviewed === true,
    input?.connectorAdapterCandidateReviewed === true,
    input?.runnerAdapterCandidateReviewed === true,
    input?.adapterPermissionContractReviewed === true,
    input?.adapterResultContractReviewed === true,
    input?.adapterAuditContractReviewed === true,
    input?.adapterRollbackContractReviewed === true,
    input?.noSideEffectCandidateBoundaryReviewed === true,
    input?.agentRegistryBoundaryReviewed === true,
    input?.stage14EntryReviewed === true,
  ];
  return {
    cursorAdapterCandidateReviewed: flags[0],
    githubAdapterCandidateReviewed: flags[1],
    connectorAdapterCandidateReviewed: flags[2],
    runnerAdapterCandidateReviewed: flags[3],
    adapterPermissionContractReviewed: flags[4],
    adapterResultContractReviewed: flags[5],
    adapterAuditContractReviewed: flags[6],
    adapterRollbackContractReviewed: flags[7],
    noSideEffectCandidateBoundaryReviewed: flags[8],
    agentRegistryBoundaryReviewed: flags[9],
    stage14EntryReviewed: flags[10],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function resolveActualExternalExecutionAdapterCandidateDecision(
  input: ActualExternalExecutionAdapterCandidateDecisionInput,
): ActualExternalExecutionAdapterCandidateDecision {
  if (input.sourceStage12Decision === "blocked") {
    return "blocked";
  }

  if (input.sourceStage12Decision === "defer") {
    return "defer";
  }

  if (input.sourceStage12Decision !== "stage12_external_execution_manual_dry_run_gate_ready") {
    return "defer";
  }

  if (input.sourceStage13EntryReady !== true) {
    return "defer";
  }

  if (
    input.sourceActualAdapterCandidateDesignAllowed !== true ||
    input.sourceActualAdapterImplementationAllowedInThisStep !== false ||
    input.sourceCursorAdapterCandidateAllowed !== true ||
    input.sourceGithubAdapterCandidateAllowed !== true ||
    input.sourceConnectorAdapterCandidateAllowed !== true ||
    input.sourceRunnerAdapterCandidateAllowed !== true ||
    input.sourceStage13CandidateBoundaryRequiredBeforeActualImplementation !== true ||
    input.sourceActualCursorAdapterImplementedInThisStep !== false ||
    input.sourceActualGithubAdapterImplementedInThisStep !== false ||
    input.sourceActualConnectorAdapterImplementedInThisStep !== false ||
    input.sourceActualRunnerAdapterImplementedInThisStep !== false ||
    input.sourceActualAdapterCredentialUsageAllowedInThisStep !== false ||
    input.sourceActualNetworkSideEffectAllowedInThisStep !== false ||
    !input.validationValid ||
    input.stage14RequiresSeparateApproval !== true ||
    input.stage14ImplementationAllowedInThisStep !== false
  ) {
    return "blocked";
  }

  if (!input.stage14EntryReady || !input.confirmationsSatisfied) {
    return "defer";
  }

  return "stage13_actual_external_execution_adapter_candidate_ready";
}
