/**
 * Stage 11-A dry-run package source evaluator (read-only).
 */

import { evaluateExternalExecutionAdapterBoundary } from "@/lib/agents/evaluateExternalExecutionAdapterBoundary";
import type { ExternalExecutionAdapterBoundaryReport } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";
import type { ExternalExecutionDryRunPackageInput } from "@/lib/agents/externalExecutionDryRunPackageTypes";

export function evaluateExternalExecutionDryRunPackageSource(
  input?: ExternalExecutionDryRunPackageInput,
): ExternalExecutionAdapterBoundaryReport {
  return evaluateExternalExecutionAdapterBoundary(input?.adapterBoundary);
}

export function isSourceReadyForExternalExecutionDryRunPackage(
  source: ExternalExecutionAdapterBoundaryReport,
): boolean {
  return (
    source.decision === "stage10_external_execution_adapter_boundary_ready" &&
    source.stage11EntryReady === true &&
    source.dryRunPackageDesignAllowed === true &&
    source.dryRunSimulationOnly === true &&
    source.stage11DryRunPackageRequiredBeforeActualExecution === true &&
    source.actualExternalExecutionImplementedInThisStep === false &&
    source.actualCursorExecutionImplementedInThisStep === false &&
    source.actualGithubWriteImplementedInThisStep === false &&
    source.actualConnectorGatewayCallImplementedInThisStep === false &&
    source.actualDbPersistenceImplementedInThisStep === false &&
    source.actualProductionRunnerImplementedInThisStep === false &&
    source.actualUiImplementationImplementedInThisStep === false &&
    source.agentRegistryChangeManagementOutOfScope === true &&
    source.agentAddRemoveDeactivateOutOfScope === true
  );
}
