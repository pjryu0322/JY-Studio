/**
 * Stage 8-B control bundle source readiness (read-only).
 */

import type { RuntimeExecutionVerticalSliceReport } from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

export function isSourceReadyForControlItems(source: RuntimeExecutionVerticalSliceReport): boolean {
  return (
    source.decision === "stage8_minimal_vertical_slice_ready" &&
    source.chainExecuted === true &&
    source.finalRecord.status === "mock_completed" &&
    source.inMemoryOnly === true &&
    source.mockRunnerOnly === true &&
    source.actualRuntimeExecutionAllowedInThisStep === false &&
    source.actualApiRouteAllowedInThisStep === false &&
    source.actualExecutionRunnerAllowedInThisStep === false &&
    source.actualDryRunRunnerAllowedInThisStep === false &&
    source.actualCursorGithubCallAllowedInThisStep === false &&
    source.actualConnectorGatewayCallAllowedInThisStep === false &&
    source.actualDbWriteAllowedInThisStep === false &&
    source.actualSchemaMigrationAllowedInThisStep === false &&
    source.actualUiAllowedInThisStep === false
  );
}
