/**
 * Stage 7-C integrated runtime contract bundle closure (read-only; no implementation permission).
 */

import type {
  RuntimeContractBundleClosureFinding,
  RuntimeContractBundleClosureInput,
  RuntimeContractBundleClosureReport,
} from "@/lib/agents/runtimeContractBundleClosureTypes";
import {
  appendRuntimeContractBundleClosureFindings,
  buildRuntimeContractBundleClosureChecklists,
  buildRuntimeContractBundleClosureFingerprint,
  buildRuntimeContractBundleClosureSummary,
  buildRuntimeContractBundleItems,
  computeStage8EntryReady,
  evaluateRuntimeContractBundleClosureSource,
  parseRuntimeContractBundleClosureInput,
  REQUIRED_STAGE7_C_BUNDLE_CLOSURE_CONFIRMATIONS,
  resolveRuntimeContractBundleClosureDecision,
  RUNTIME_CONTRACT_BUNDLE_CLOSURE_TITLE,
  RUNTIME_CONTRACT_BUNDLE_CLOSURE_VERSION,
  STAGE7_C_RECOMMENDED_NEXT_PHASES,
  STAGE7_C_SEPARATED_WORK_ITEMS,
  STAGE8_A_MINIMAL_VERTICAL_SLICE_SCOPE,
  STAGE8_A_OUT_OF_SCOPE,
  STAGE8_ENTRY_CANDIDATE,
  validateRuntimeContractBundleItems,
} from "@/lib/agents/runtimeContractBundleClosureSupport";

export {
  resolveRuntimeContractBundleClosureDecision,
  validateRuntimeContractBundleItems,
  buildRuntimeContractBundleItems,
} from "@/lib/agents/runtimeContractBundleClosureSupport";

export {
  buildStage7CReadyContractBundleClosureInput,
  buildStage7CContractBundleClosureConfirmedInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type { RuntimeContractBundleClosureDecisionInput } from "@/lib/agents/runtimeContractBundleClosureTypes";

/** Read-only Stage 7-C contract bundle closure — does not grant implementation permission. */
export function evaluateRuntimeContractBundleClosure(
  input: RuntimeContractBundleClosureInput = {},
): RuntimeContractBundleClosureReport {
  const source = evaluateRuntimeContractBundleClosureSource(input);
  const parsed = parseRuntimeContractBundleClosureInput(input);
  const bundleItems = buildRuntimeContractBundleItems(source);
  const bundleValidation = validateRuntimeContractBundleItems(bundleItems);
  const bundleItemsValid = bundleValidation.valid;
  const bundleItemCount = bundleItems.length;
  const stage8CandidateItemCount = bundleItems.filter((item) => item.stage8Candidate).length;
  const requiredBeforeStage8ItemCount = bundleItems.filter((item) => item.requiredBeforeStage8).length;
  const stage8EntryReady = computeStage8EntryReady(bundleItems, bundleValidation);

  const decision = resolveRuntimeContractBundleClosureDecision({
    sourceApiContractDecision: source.decision,
    sourceEndpointContractCount: source.endpointContractCount,
    sourceEndpointDesignOnlyCount: source.endpointDesignOnlyCount,
    sourceImplementedEndpointCount: source.implementedEndpointCount,
    sourceActualRuntimeExecutionAllowedInThisStep: source.sourceActualRuntimeExecutionAllowedInThisStep,
    sourceActualExecutionRunnerAllowedInThisStep: source.sourceActualExecutionRunnerAllowedInThisStep,
    sourceActualDryRunRunnerAllowedInThisStep: source.sourceActualDryRunRunnerAllowedInThisStep,
    sourceActualExecutionWireAllowedInThisStep: source.sourceActualExecutionWireAllowedInThisStep,
    sourceActualPersistenceAllowedInThisStep: source.sourceActualPersistenceAllowedInThisStep,
    sourceActualExternalSideEffectAllowedInThisStep: source.sourceActualExternalSideEffectAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.sourceActualSchemaMigrationAllowedInThisStep,
    sourceActualCursorGithubWireAllowedInThisStep: source.sourceActualCursorGithubWireAllowedInThisStep,
    sourceActualConnectorRoutingChangeAllowedInThisStep: source.sourceActualConnectorRoutingChangeAllowedInThisStep,
    sourceActualUiImplementationAllowedInThisStep: source.sourceActualUiImplementationAllowedInThisStep,
    bundleItemsValid,
    stage8EntryReady,
    stage8EntryRequiresSeparateApproval: true,
    stage8EntryImplementationAllowedInThisStep: false,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const bundleFingerprint = buildRuntimeContractBundleClosureFingerprint({
    sourceApiContractFingerprint: source.apiContractFingerprint,
    bundleItemCount,
    stage8CandidateItemCount,
    requiredBeforeStage8ItemCount,
    stage8EntryReady,
    stage8EntryRequiresSeparateApproval: true,
    stage8EntryImplementationAllowedInThisStep: false,
    confirmationCount: parsed.confirmationCount,
  });

  const { closureChecklist, boundaryChecklist, stage8EntryChecklist } = buildRuntimeContractBundleClosureChecklists({
    parsed,
    source,
    bundleItemsValid,
    bundleItemCount,
    stage8EntryReady,
  });

  const findings: RuntimeContractBundleClosureFinding[] = [];
  appendRuntimeContractBundleClosureFindings({
    findings,
    decision,
    source,
    parsed,
    bundleValidation,
    stage8EntryReady,
  });

  return {
    mode: "read_only_runtime_contract_bundle_closure",
    stage: "stage_7_c_runtime_contract_bundle_closure",
    decision,
    sourceApiContractDecision: source.decision,
    sourceApiContractVersion: source.apiContractVersion,
    sourceApiContractFingerprint: source.apiContractFingerprint,
    sourceEndpointContractCount: source.endpointContractCount,
    sourceEndpointDesignOnlyCount: source.endpointDesignOnlyCount,
    sourceImplementedEndpointCount: source.implementedEndpointCount,
    sourceActualRuntimeExecutionAllowedInThisStep: source.sourceActualRuntimeExecutionAllowedInThisStep,
    sourceActualExecutionRunnerAllowedInThisStep: source.sourceActualExecutionRunnerAllowedInThisStep,
    sourceActualDryRunRunnerAllowedInThisStep: source.sourceActualDryRunRunnerAllowedInThisStep,
    sourceActualExecutionWireAllowedInThisStep: source.sourceActualExecutionWireAllowedInThisStep,
    sourceActualPersistenceAllowedInThisStep: source.sourceActualPersistenceAllowedInThisStep,
    sourceActualExternalSideEffectAllowedInThisStep: source.sourceActualExternalSideEffectAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.sourceActualSchemaMigrationAllowedInThisStep,
    sourceActualCursorGithubWireAllowedInThisStep: source.sourceActualCursorGithubWireAllowedInThisStep,
    sourceActualConnectorRoutingChangeAllowedInThisStep: source.sourceActualConnectorRoutingChangeAllowedInThisStep,
    sourceActualUiImplementationAllowedInThisStep: source.sourceActualUiImplementationAllowedInThisStep,
    bundleVersion: RUNTIME_CONTRACT_BUNDLE_CLOSURE_VERSION,
    bundleTitle: RUNTIME_CONTRACT_BUNDLE_CLOSURE_TITLE,
    bundleSummary: buildRuntimeContractBundleClosureSummary(decision),
    bundleFingerprint,
    contractBundleClosureOnly: true,
    stage8EntryCandidate: STAGE8_ENTRY_CANDIDATE,
    stage8EntryReady,
    stage8EntryScope: [...STAGE8_A_MINIMAL_VERTICAL_SLICE_SCOPE],
    stage8EntryOutOfScope: [...STAGE8_A_OUT_OF_SCOPE],
    stage8EntryRequiresSeparateApproval: true,
    stage8EntryImplementationAllowedInThisStep: false,
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
    requiredConfirmations: [...REQUIRED_STAGE7_C_BUNDLE_CLOSURE_CONFIRMATIONS],
    bundleItems,
    bundleValidation,
    closureChecklist,
    boundaryChecklist,
    stage8EntryChecklist,
    findings,
    bundleItemCount,
    stage8CandidateItemCount,
    requiredBeforeStage8ItemCount,
    recommendedNextPhases: [...STAGE7_C_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE7_C_SEPARATED_WORK_ITEMS],
  };
}
