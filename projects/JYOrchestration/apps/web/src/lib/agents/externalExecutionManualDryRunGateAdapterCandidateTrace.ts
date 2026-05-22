/**
 * Stage 12-A actual adapter candidate hardening trace (read-only).
 */

export function buildExternalExecutionManualDryRunGateAdapterCandidateFields() {
  return {
    actualAdapterCandidateDesignAllowed: true as const,
    actualAdapterImplementationAllowedInThisStep: false as const,
    cursorAdapterCandidateAllowed: true as const,
    githubAdapterCandidateAllowed: true as const,
    connectorAdapterCandidateAllowed: true as const,
    runnerAdapterCandidateAllowed: true as const,
    stage13CandidateBoundaryRequiredBeforeActualImplementation: true as const,
    actualCursorAdapterImplementedInThisStep: false as const,
    actualGithubAdapterImplementedInThisStep: false as const,
    actualConnectorAdapterImplementedInThisStep: false as const,
    actualRunnerAdapterImplementedInThisStep: false as const,
    actualAdapterCredentialUsageAllowedInThisStep: false as const,
    actualNetworkSideEffectAllowedInThisStep: false as const,
  };
}
