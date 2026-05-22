/**
 * Stage 13-A decision input mapping from Stage 12-A manual gate source (read-only).
 */

import type { ActualExternalExecutionAdapterCandidateDecisionInput } from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";
import type { ExternalExecutionManualDryRunGateReport } from "@/lib/agents/externalExecutionManualDryRunGateTypes";
import {
  mapActualExternalExecutionAdapterCandidateAdapterImplementationBoundaryTrace,
  mapActualExternalExecutionAdapterCandidateSourceTrace,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateSourceTrace";

export const STAGE14_ENTRY_CANDIDATE = "operator_approved_actual_external_execution" as const;

export function mapActualExternalExecutionAdapterCandidateDecisionInputFromSource(
  source: ExternalExecutionManualDryRunGateReport,
  input: {
    readonly validationValid: boolean;
    readonly stage14EntryReady: boolean;
    readonly confirmationsSatisfied: boolean;
  },
): ActualExternalExecutionAdapterCandidateDecisionInput {
  return {
    ...mapActualExternalExecutionAdapterCandidateSourceTrace(source),
    ...mapActualExternalExecutionAdapterCandidateAdapterImplementationBoundaryTrace(source),
    validationValid: input.validationValid,
    stage14EntryReady: input.stage14EntryReady,
    confirmationsSatisfied: input.confirmationsSatisfied,
    stage14RequiresSeparateApproval: true,
    stage14ImplementationAllowedInThisStep: false,
  };
}

export function buildActualExternalExecutionAdapterCandidateStage14ReportFields(input: {
  readonly stage14EntryReady: boolean;
}) {
  return {
    candidateOnly: true as const,
    stage14EntryCandidate: STAGE14_ENTRY_CANDIDATE,
    stage14EntryReady: input.stage14EntryReady,
    stage14RequiresSeparateApproval: true as const,
    stage14ImplementationAllowedInThisStep: false as const,
    actualExternalExecutionImplementedInThisStep: false as const,
    actualCursorAdapterImplementedInThisStep: false as const,
    actualGithubAdapterImplementedInThisStep: false as const,
    actualConnectorAdapterImplementedInThisStep: false as const,
    actualRunnerAdapterImplementedInThisStep: false as const,
    actualAdapterCredentialUsageAllowedInThisStep: false as const,
    actualNetworkSideEffectAllowedInThisStep: false as const,
    actualDbPersistenceImplementedInThisStep: false as const,
    actualUiImplementationImplementedInThisStep: false as const,
    agentRegistryMutationImplementedInThisStep: false as const,
  };
}
