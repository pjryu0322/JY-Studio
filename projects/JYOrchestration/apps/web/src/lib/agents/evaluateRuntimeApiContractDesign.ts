/**
 * Stage 7-B runtime API contract design (read-only; no API endpoint implementation).
 */

import type {
  RuntimeApiContractDesignFinding,
  RuntimeApiContractDesignInput,
  RuntimeApiContractDesignReport,
} from "@/lib/agents/runtimeApiContractDesignTypes";
import {
  appendRuntimeApiContractDesignFindings,
  buildRuntimeApiContractDesignChecklists,
  buildRuntimeApiContractDesignFingerprint,
  buildRuntimeApiContractDesignSummary,
  buildRuntimeApiEndpointContracts,
  computeRuntimeApiContractTrace,
  evaluateRuntimeApiContractDesignSource,
  parseRuntimeApiContractDesignInput,
  REQUIRED_STAGE7_B_RUNTIME_API_CONFIRMATIONS,
  resolveRuntimeApiContractDesignDecision,
  RUNTIME_API_CONTRACT_DESIGN_TITLE,
  RUNTIME_API_CONTRACT_DESIGN_VERSION,
  STAGE7_B_RECOMMENDED_NEXT_PHASES,
  STAGE7_B_SEPARATED_WORK_ITEMS,
  validateRuntimeApiEndpointContracts,
} from "@/lib/agents/runtimeApiContractDesignSupport";

export {
  resolveRuntimeApiContractDesignDecision,
  validateRuntimeApiEndpointContracts,
  buildRuntimeApiEndpointContracts,
} from "@/lib/agents/runtimeApiContractDesignSupport";

export {
  buildStage7BReadyRuntimeApiContractInput,
  buildStage7BRuntimeApiContractConfirmedInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type { RuntimeApiContractDesignDecisionInput } from "@/lib/agents/runtimeApiContractDesignTypes";

/** Read-only Stage 7-B API contract design — does not implement API endpoints. */
export function evaluateRuntimeApiContractDesign(
  input: RuntimeApiContractDesignInput = {},
): RuntimeApiContractDesignReport {
  const source = evaluateRuntimeApiContractDesignSource(input);
  const parsed = parseRuntimeApiContractDesignInput(input);
  const endpointContracts = buildRuntimeApiEndpointContracts(source);
  const endpointValidation = validateRuntimeApiEndpointContracts(endpointContracts);
  const endpointContractsValid = endpointValidation.valid;
  const endpointContractCount = endpointContracts.length;
  const trace = computeRuntimeApiContractTrace(endpointContracts);

  const decision = resolveRuntimeApiContractDesignDecision({
    sourcePlanningDecision: source.decision,
    sourcePlanningCandidateOnly: source.planningCandidateOnly === true,
    sourcePlanningItemCount: source.planningItemCount,
    sourceActualRuntimeExecutionAllowedInThisStep: source.sourceActualRuntimeExecutionAllowedInThisStep,
    sourceActualExecutionRunnerAllowedInThisStep: source.sourceActualExecutionRunnerAllowedInThisStep,
    sourceActualPersistenceAllowedInThisStep: source.sourceActualPersistenceAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.sourceActualSchemaMigrationAllowedInThisStep,
    sourceActualCursorGithubWireAllowedInThisStep: source.sourceActualCursorGithubWireAllowedInThisStep,
    sourceActualConnectorRoutingChangeAllowedInThisStep: source.sourceActualConnectorRoutingChangeAllowedInThisStep,
    endpointContractsValid,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const apiContractFingerprint = buildRuntimeApiContractDesignFingerprint({
    sourcePlanningFingerprint: source.planningFingerprint,
    endpointContractCount,
    statusTransitionCount: trace.statusTransitionCount,
    errorCodeCount: trace.errorCodeCount,
    auditEventCount: trace.auditEventCount,
    confirmationCount: parsed.confirmationCount,
  });

  const { apiChecklist, boundaryChecklist, approvalChecklist } = buildRuntimeApiContractDesignChecklists({
    parsed,
    source,
    endpointContractsValid,
    endpointContractCount,
    statusTransitionCount: trace.statusTransitionCount,
    errorCodeCount: trace.errorCodeCount,
    auditEventCount: trace.auditEventCount,
  });

  const findings: RuntimeApiContractDesignFinding[] = [];
  appendRuntimeApiContractDesignFindings({
    findings,
    decision,
    source,
    parsed,
    endpointValidation,
  });

  return {
    mode: "read_only_runtime_api_contract_design",
    stage: "stage_7_b_runtime_api_contract_design",
    decision,
    sourcePlanningDecision: source.decision,
    sourcePlanningVersion: source.planningVersion,
    sourcePlanningFingerprint: source.planningFingerprint,
    sourcePlanningCandidateOnly: source.planningCandidateOnly,
    sourcePlanningItemCount: source.planningItemCount,
    sourceActualRuntimeExecutionAllowedInThisStep: source.sourceActualRuntimeExecutionAllowedInThisStep,
    sourceActualExecutionRunnerAllowedInThisStep: source.sourceActualExecutionRunnerAllowedInThisStep,
    sourceActualPersistenceAllowedInThisStep: source.sourceActualPersistenceAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.sourceActualSchemaMigrationAllowedInThisStep,
    sourceActualCursorGithubWireAllowedInThisStep: source.sourceActualCursorGithubWireAllowedInThisStep,
    sourceActualConnectorRoutingChangeAllowedInThisStep: source.sourceActualConnectorRoutingChangeAllowedInThisStep,
    apiContractVersion: RUNTIME_API_CONTRACT_DESIGN_VERSION,
    apiContractTitle: RUNTIME_API_CONTRACT_DESIGN_TITLE,
    apiContractSummary: buildRuntimeApiContractDesignSummary(decision),
    apiContractFingerprint,
    apiContractDesignOnly: true,
    actualApiEndpointImplementedInThisStep: false,
    actualRuntimeExecutionAllowedInThisStep: false,
    actualExecutionRunnerAllowedInThisStep: false,
    actualDryRunRunnerAllowedInThisStep: false,
    actualExecutionWireAllowedInThisStep: false,
    actualPersistenceAllowedInThisStep: false,
    actualExternalSideEffectAllowedInThisStep: false,
    actualSchemaMigrationAllowedInThisStep: false,
    actualCursorGithubWireAllowedInThisStep: false,
    actualConnectorRoutingChangeAllowedInThisStep: false,
    actualUiImplementationAllowedInThisStep: false,
    requiredConfirmations: [...REQUIRED_STAGE7_B_RUNTIME_API_CONFIRMATIONS],
    endpointContracts,
    apiChecklist,
    boundaryChecklist,
    approvalChecklist,
    findings,
    endpointContractCount,
    statusTransitionCount: trace.statusTransitionCount,
    errorCodeCount: trace.errorCodeCount,
    auditEventCount: trace.auditEventCount,
    recommendedNextPhases: [...STAGE7_B_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE7_B_SEPARATED_WORK_ITEMS],
  };
}
