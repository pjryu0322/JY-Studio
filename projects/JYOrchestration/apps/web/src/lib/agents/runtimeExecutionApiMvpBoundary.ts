/**
 * Stage 9-A API response boundary report (no-run flags).
 */

import type { RuntimeExecutionApiBoundaryReport } from "@/lib/agents/runtimeExecutionApiMvpTypes";

export function buildRuntimeExecutionApiBoundaryReport(): RuntimeExecutionApiBoundaryReport {
  return {
    inMemoryOnly: true,
    actualExternalExecutionAllowed: false,
    actualCursorGithubCallAllowed: false,
    actualConnectorGatewayCallAllowed: false,
    actualDbWriteAllowed: false,
    actualSchemaMigrationAllowed: false,
    actualUiMutationAllowed: false,
  };
}
