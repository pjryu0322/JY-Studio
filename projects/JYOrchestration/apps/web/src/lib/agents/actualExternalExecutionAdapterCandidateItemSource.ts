/**
 * Stage 13-A adapter candidate source readiness (read-only).
 */

import type { ExternalExecutionManualDryRunGateReport } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

export function isSourceReadyForActualExternalExecutionAdapterCandidate(
  source: ExternalExecutionManualDryRunGateReport,
): boolean {
  return (
    source.decision === "stage12_external_execution_manual_dry_run_gate_ready" &&
    source.stage13EntryReady === true &&
    source.actualAdapterCandidateDesignAllowed === true &&
    source.actualAdapterImplementationAllowedInThisStep === false &&
    source.cursorAdapterCandidateAllowed === true &&
    source.githubAdapterCandidateAllowed === true &&
    source.connectorAdapterCandidateAllowed === true &&
    source.runnerAdapterCandidateAllowed === true &&
    source.stage13CandidateBoundaryRequiredBeforeActualImplementation === true &&
    source.actualCursorAdapterImplementedInThisStep === false &&
    source.actualGithubAdapterImplementedInThisStep === false &&
    source.actualConnectorAdapterImplementedInThisStep === false &&
    source.actualRunnerAdapterImplementedInThisStep === false &&
    source.actualAdapterCredentialUsageAllowedInThisStep === false &&
    source.actualNetworkSideEffectAllowedInThisStep === false
  );
}
