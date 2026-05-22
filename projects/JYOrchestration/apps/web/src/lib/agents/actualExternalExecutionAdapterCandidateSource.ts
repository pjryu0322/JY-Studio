/**
 * Stage 13-A adapter candidate source evaluator (read-only).
 */

import { evaluateExternalExecutionManualDryRunGate } from "@/lib/agents/evaluateExternalExecutionManualDryRunGate";
import type { ActualExternalExecutionAdapterCandidateInput } from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";
import type { ExternalExecutionManualDryRunGateReport } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

export function evaluateActualExternalExecutionAdapterCandidateSource(
  input?: ActualExternalExecutionAdapterCandidateInput,
): ExternalExecutionManualDryRunGateReport {
  return evaluateExternalExecutionManualDryRunGate(input?.manualDryRunGate);
}

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
