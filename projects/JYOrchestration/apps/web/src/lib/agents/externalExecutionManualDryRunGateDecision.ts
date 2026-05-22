/**
 * Stage 12-A manual dry-run gate decision (read-only).
 */

import type {
  ExternalExecutionManualDryRunGateDecision,
  ExternalExecutionManualDryRunGateDecisionInput,
  ExternalExecutionManualDryRunGateInput,
  ParsedExternalExecutionManualDryRunGateInput,
} from "@/lib/agents/externalExecutionManualDryRunGateTypes";

export function parseExternalExecutionManualDryRunGateInput(
  input?: ExternalExecutionManualDryRunGateInput,
): ParsedExternalExecutionManualDryRunGateInput {
  const flags = [
    input?.manualGateReviewed === true,
    input?.operatorInvocationReviewed === true,
    input?.mockAdapterResultReviewed === true,
    input?.dryRunAuditReviewed === true,
    input?.rollbackReviewCompleted === true,
    input?.noSideEffectBoundaryReviewed === true,
    input?.agentRegistryBoundaryReviewed === true,
    input?.stage13EntryReviewed === true,
  ];
  return {
    manualGateReviewed: flags[0],
    operatorInvocationReviewed: flags[1],
    mockAdapterResultReviewed: flags[2],
    dryRunAuditReviewed: flags[3],
    rollbackReviewCompleted: flags[4],
    noSideEffectBoundaryReviewed: flags[5],
    agentRegistryBoundaryReviewed: flags[6],
    stage13EntryReviewed: flags[7],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function resolveExternalExecutionManualDryRunGateDecision(
  input: ExternalExecutionManualDryRunGateDecisionInput,
): ExternalExecutionManualDryRunGateDecision {
  if (input.sourceStage11Decision === "blocked") {
    return "blocked";
  }

  if (input.sourceStage11Decision === "defer") {
    return "defer";
  }

  if (input.sourceStage11Decision !== "stage11_external_execution_dry_run_package_ready") {
    return "defer";
  }

  if (input.sourceStage12EntryReady !== true) {
    return "defer";
  }

  if (
    input.sourceManualDryRunGateDesignAllowed !== true ||
    input.sourceOperatorApprovedDryRunInvocationAllowed !== true ||
    input.sourceMockExternalAdapterResultPackageAllowed !== true ||
    input.sourceDryRunAuditEventPackageAllowed !== true ||
    input.sourceRollbackPlanReviewBeforeActualExecutionAllowed !== true ||
    input.sourceStage12ManualGateRequiredBeforeActualExecution !== true ||
    input.sourceActualManualExternalInvocationAllowedInThisStep !== false ||
    input.sourceActualAdapterSideEffectAllowedInThisStep !== false ||
    input.sourceActualAgentRegistryMutationAllowedInThisStep !== false ||
    !input.validationValid ||
    input.stage13RequiresSeparateApproval !== true ||
    input.stage13ImplementationAllowedInThisStep !== false
  ) {
    return "blocked";
  }

  if (!input.stage13EntryReady || !input.confirmationsSatisfied) {
    return "defer";
  }

  return "stage12_external_execution_manual_dry_run_gate_ready";
}
