/**
 * Stage 12-A decision input mapping from Stage 11-A dry-run package source (read-only).
 */

import type { ExternalExecutionDryRunPackageReport } from "@/lib/agents/externalExecutionDryRunPackageTypes";
import type { ExternalExecutionManualDryRunGateDecisionInput } from "@/lib/agents/externalExecutionManualDryRunGateTypes";
import {
  mapExternalExecutionManualDryRunGateActualExecutionBoundaryTrace,
  mapExternalExecutionManualDryRunGateSourceTrace,
} from "@/lib/agents/externalExecutionManualDryRunGateSourceTrace";

export const STAGE13_ENTRY_CANDIDATE = "actual_external_execution_adapter_candidate" as const;

export function mapExternalExecutionManualDryRunGateDecisionInputFromSource(
  source: ExternalExecutionDryRunPackageReport,
  input: {
    readonly validationValid: boolean;
    readonly stage13EntryReady: boolean;
    readonly confirmationsSatisfied: boolean;
  },
): ExternalExecutionManualDryRunGateDecisionInput {
  return {
    ...mapExternalExecutionManualDryRunGateSourceTrace(source),
    ...mapExternalExecutionManualDryRunGateActualExecutionBoundaryTrace(source),
    validationValid: input.validationValid,
    stage13EntryReady: input.stage13EntryReady,
    confirmationsSatisfied: input.confirmationsSatisfied,
    stage13RequiresSeparateApproval: true,
    stage13ImplementationAllowedInThisStep: false,
  };
}

export function buildExternalExecutionManualDryRunGateStage13ReportFields(input: {
  readonly stage13EntryReady: boolean;
}) {
  return {
    manualGateOnly: true as const,
    stage13EntryCandidate: STAGE13_ENTRY_CANDIDATE,
    stage13EntryReady: input.stage13EntryReady,
    stage13RequiresSeparateApproval: true as const,
    stage13ImplementationAllowedInThisStep: false as const,
    actualExternalInvocationImplementedInThisStep: false as const,
    actualAdapterSideEffectImplementedInThisStep: false as const,
    actualCursorExecutionImplementedInThisStep: false as const,
    actualGithubWriteImplementedInThisStep: false as const,
    actualConnectorGatewayCallImplementedInThisStep: false as const,
    actualDbPersistenceImplementedInThisStep: false as const,
    actualProductionRunnerImplementedInThisStep: false as const,
    actualUiImplementationImplementedInThisStep: false as const,
    agentRegistryMutationImplementedInThisStep: false as const,
  };
}
