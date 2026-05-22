/**
 * Stage 9-B closure bundle source readiness (read-only).
 */

import type { RuntimeExecutionApiMvpReport } from "@/lib/agents/runtimeExecutionApiMvpTypes";

export function isSourceReadyForMvpClosureItems(source: RuntimeExecutionApiMvpReport): boolean {
  return (
    source.decision === "stage9_runtime_execution_api_mvp_ready" &&
    source.stage9AClosureReady === true &&
    source.actualApiRouteImplementedInThisStep === true &&
    source.inMemoryStoreImplementedInThisStep === true &&
    source.mockRunnerAdapterImplementedInThisStep === true &&
    source.actualExternalExecutionAllowedInThisStep === false &&
    source.actualCursorGithubCallAllowedInThisStep === false &&
    source.actualConnectorGatewayCallAllowedInThisStep === false &&
    source.actualDbWriteAllowedInThisStep === false &&
    source.actualSchemaMigrationAllowedInThisStep === false &&
    source.actualUiImplementationAllowedInThisStep === false
  );
}
