/**
 * Stage 10-A adapter boundary source readiness (read-only).
 */

import { STAGE10_ENTRY_MODE } from "@/lib/agents/runtimeExecutionMvpClosureStage10Trace";
import type { RuntimeExecutionMvpClosureReport } from "@/lib/agents/runtimeExecutionMvpClosureTypes";

export function isSourceReadyForAdapterBoundaryItems(source: RuntimeExecutionMvpClosureReport): boolean {
  return (
    source.decision === "stage9_runtime_api_mvp_closed" &&
    source.stage10EntryReady === true &&
    source.stage10EntryMode === STAGE10_ENTRY_MODE &&
    source.stage10AdapterBoundaryDesignAllowed === true &&
    source.stage10CursorGithubBoundaryDesignAllowed === true &&
    source.stage10ConnectorBoundaryDesignAllowed === true &&
    source.stage10RunnerBoundaryDesignAllowed === true &&
    source.stage10DryRunSimulationDesignAllowed === true &&
    source.stage10RollbackBoundaryDesignAllowed === true &&
    source.stage10ActualCursorExecutionAllowed === false &&
    source.stage10ActualGithubWriteAllowed === false &&
    source.stage10ActualConnectorGatewayCallAllowed === false &&
    source.stage10ActualDbPersistenceAllowed === false &&
    source.stage10ActualProductionRunnerAllowed === false &&
    source.stage10ActualUiImplementationAllowed === false
  );
}
