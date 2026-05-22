/**
 * Stage 9-A integrated runtime execution API + in-memory store MVP evaluator.
 */

import type {
  RuntimeExecutionApiMvpFinding,
  RuntimeExecutionApiMvpInput,
  RuntimeExecutionApiMvpReport,
} from "@/lib/agents/runtimeExecutionApiMvpTypes";
import { computeStage9AClosureReady } from "@/lib/agents/runtimeExecutionApiMvpClosureReady";
import {
  REQUIRED_STAGE9_A_CONFIRMATIONS,
  RUNTIME_EXECUTION_API_MVP_TITLE,
  RUNTIME_EXECUTION_API_MVP_VERSION,
  STAGE9_A_ENDPOINT_CONTRACTS,
  STAGE9_A_RECOMMENDED_NEXT_PHASES,
  STAGE9_A_SEPARATED_WORK_ITEMS,
  STAGE9_A_SUPPORTED_ACTIONS,
  appendRuntimeExecutionApiMvpFindings,
  buildRuntimeExecutionApiMvpChecklists,
  buildRuntimeExecutionApiMvpFingerprint,
  buildRuntimeExecutionApiMvpSummary,
  evaluateRuntimeExecutionApiMvpSource,
  parseRuntimeExecutionApiMvpInput,
  resolveRuntimeExecutionApiMvpDecision,
} from "@/lib/agents/runtimeExecutionApiMvpSupport";
import {
  STAGE9_A_ROUTE_HANDLER_COUNT,
  STAGE9_A_SERVICE_ACTION_COUNT,
} from "@/lib/agents/runtimeExecutionApiMvpConstants";

export { resolveRuntimeExecutionApiMvpDecision } from "@/lib/agents/runtimeExecutionApiMvpSupport";
export { buildRuntimeExecutionApiMvpFingerprint } from "@/lib/agents/runtimeExecutionApiMvpFingerprint";

export {
  buildStage9AReadyRuntimeExecutionApiMvpInput,
  buildStage9AConfirmedRuntimeExecutionApiMvpInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type { RuntimeExecutionApiMvpDecisionInput } from "@/lib/agents/runtimeExecutionApiMvpTypes";

/** Stage 9-A runtime execution API MVP — in-memory store and mock runner only. */
export function evaluateRuntimeExecutionApiMvp(
  input: RuntimeExecutionApiMvpInput = {},
): RuntimeExecutionApiMvpReport {
  const source = evaluateRuntimeExecutionApiMvpSource(input);
  const parsed = parseRuntimeExecutionApiMvpInput(input);

  const decision = resolveRuntimeExecutionApiMvpDecision({
    sourceDecision: source.decision,
    sourceStage9EntryReady: source.stage9EntryReady,
    sourceStage9EntryMode: source.stage9EntryMode,
    sourceStage9ActualExternalExecutionAllowed: source.stage9ActualExternalExecutionAllowed,
    sourceStage9DbPersistenceAllowed: source.stage9DbPersistenceAllowed,
    sourceStage9UiImplementationAllowed: source.stage9UiImplementationAllowed,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const { checklist, boundaryChecklist } = buildRuntimeExecutionApiMvpChecklists({
    sourceStage8Decision: source.decision,
    sourceStage9EntryReady: source.stage9EntryReady,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const findings: RuntimeExecutionApiMvpFinding[] = [];
  appendRuntimeExecutionApiMvpFindings({
    findings,
    decision,
    source,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const apiMvpFingerprint = buildRuntimeExecutionApiMvpFingerprint({
    sourceStage8Decision: source.decision,
    sourceStage9EntryMode: source.stage9EntryMode,
    confirmationCount: parsed.confirmationCount,
    endpointCount: STAGE9_A_ENDPOINT_CONTRACTS.length,
  });

  const stage9AClosureReady = computeStage9AClosureReady({ decision });

  return {
    mode: "in_memory_runtime_execution_api_mvp",
    stage: "stage_9_a_runtime_execution_api_and_in_memory_store",
    decision,
    sourceStage8Decision: source.decision,
    sourceStage9EntryReady: source.stage9EntryReady,
    sourceStage9EntryMode: source.stage9EntryMode,
    sourceStage9ActualExternalExecutionAllowed: source.stage9ActualExternalExecutionAllowed,
    sourceStage9DbPersistenceAllowed: source.stage9DbPersistenceAllowed,
    sourceStage9UiImplementationAllowed: source.stage9UiImplementationAllowed,
    apiMvpVersion: RUNTIME_EXECUTION_API_MVP_VERSION,
    apiMvpTitle: RUNTIME_EXECUTION_API_MVP_TITLE,
    apiMvpSummary: buildRuntimeExecutionApiMvpSummary(decision),
    apiMvpFingerprint,
    actualApiRouteImplementedInThisStep: true,
    inMemoryStoreImplementedInThisStep: true,
    mockRunnerAdapterImplementedInThisStep: true,
    actualExternalExecutionAllowedInThisStep: false,
    actualCursorGithubCallAllowedInThisStep: false,
    actualConnectorGatewayCallAllowedInThisStep: false,
    actualDbWriteAllowedInThisStep: false,
    actualSchemaMigrationAllowedInThisStep: false,
    actualUiImplementationAllowedInThisStep: false,
    routeHandlerCount: STAGE9_A_ROUTE_HANDLER_COUNT,
    serviceActionCount: STAGE9_A_SERVICE_ACTION_COUNT,
    storeKind: "in_memory_map",
    boundaryReportIncludedInEveryResponse: true,
    approvalActionImplemented: true,
    mockRunnerAdapterImplemented: true,
    auditQueryImplemented: true,
    statusQueryImplemented: true,
    stage9AClosureReady,
    supportedActions: [...STAGE9_A_SUPPORTED_ACTIONS],
    endpointContracts: [...STAGE9_A_ENDPOINT_CONTRACTS],
    requiredConfirmations: [...REQUIRED_STAGE9_A_CONFIRMATIONS],
    checklist,
    boundaryChecklist,
    findings,
    recommendedNextPhases: [...STAGE9_A_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE9_A_SEPARATED_WORK_ITEMS],
  };
}
