/**
 * Stage 13-A source trace from Stage 12-A manual dry-run gate (read-only).
 */

import type {
  ActualExternalExecutionAdapterCandidateDecisionInput,
  ActualExternalExecutionAdapterCandidateReport,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";
import type { ExternalExecutionManualDryRunGateReport } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

export function mapActualExternalExecutionAdapterCandidateSourceTrace(
  source: ExternalExecutionManualDryRunGateReport,
): Pick<
  ActualExternalExecutionAdapterCandidateReport,
  | "sourceStage12Decision"
  | "sourceStage13EntryReady"
  | "sourceActualAdapterCandidateDesignAllowed"
  | "sourceActualAdapterImplementationAllowedInThisStep"
  | "sourceCursorAdapterCandidateAllowed"
  | "sourceGithubAdapterCandidateAllowed"
  | "sourceConnectorAdapterCandidateAllowed"
  | "sourceRunnerAdapterCandidateAllowed"
  | "sourceStage13CandidateBoundaryRequiredBeforeActualImplementation"
> {
  return {
    sourceStage12Decision: source.decision,
    sourceStage13EntryReady: source.stage13EntryReady,
    sourceActualAdapterCandidateDesignAllowed: source.actualAdapterCandidateDesignAllowed,
    sourceActualAdapterImplementationAllowedInThisStep: source.actualAdapterImplementationAllowedInThisStep,
    sourceCursorAdapterCandidateAllowed: source.cursorAdapterCandidateAllowed,
    sourceGithubAdapterCandidateAllowed: source.githubAdapterCandidateAllowed,
    sourceConnectorAdapterCandidateAllowed: source.connectorAdapterCandidateAllowed,
    sourceRunnerAdapterCandidateAllowed: source.runnerAdapterCandidateAllowed,
    sourceStage13CandidateBoundaryRequiredBeforeActualImplementation:
      source.stage13CandidateBoundaryRequiredBeforeActualImplementation,
  };
}

export function mapActualExternalExecutionAdapterCandidateAdapterImplementationBoundaryTrace(
  source: ExternalExecutionManualDryRunGateReport,
): Pick<
  ActualExternalExecutionAdapterCandidateDecisionInput,
  | "sourceActualCursorAdapterImplementedInThisStep"
  | "sourceActualGithubAdapterImplementedInThisStep"
  | "sourceActualConnectorAdapterImplementedInThisStep"
  | "sourceActualRunnerAdapterImplementedInThisStep"
  | "sourceActualAdapterCredentialUsageAllowedInThisStep"
  | "sourceActualNetworkSideEffectAllowedInThisStep"
> {
  return {
    sourceActualCursorAdapterImplementedInThisStep: source.actualCursorAdapterImplementedInThisStep,
    sourceActualGithubAdapterImplementedInThisStep: source.actualGithubAdapterImplementedInThisStep,
    sourceActualConnectorAdapterImplementedInThisStep: source.actualConnectorAdapterImplementedInThisStep,
    sourceActualRunnerAdapterImplementedInThisStep: source.actualRunnerAdapterImplementedInThisStep,
    sourceActualAdapterCredentialUsageAllowedInThisStep: source.actualAdapterCredentialUsageAllowedInThisStep,
    sourceActualNetworkSideEffectAllowedInThisStep: source.actualNetworkSideEffectAllowedInThisStep,
  };
}
