/**
 * Stage 12-A manual dry-run gate source readiness (read-only).
 */

import type { ExternalExecutionDryRunPackageReport } from "@/lib/agents/externalExecutionDryRunPackageTypes";

export function isSourceReadyForExternalExecutionManualDryRunGate(
  source: ExternalExecutionDryRunPackageReport,
): boolean {
  return (
    source.decision === "stage11_external_execution_dry_run_package_ready" &&
    source.stage12EntryReady === true &&
    source.manualDryRunGateDesignAllowed === true &&
    source.operatorApprovedDryRunInvocationAllowed === true &&
    source.mockExternalAdapterResultPackageAllowed === true &&
    source.dryRunAuditEventPackageAllowed === true &&
    source.rollbackPlanReviewBeforeActualExecutionAllowed === true &&
    source.stage12ManualGateRequiredBeforeActualExecution === true &&
    source.actualManualExternalInvocationAllowedInThisStep === false &&
    source.actualAdapterSideEffectAllowedInThisStep === false &&
    source.actualAgentRegistryMutationAllowedInThisStep === false
  );
}
