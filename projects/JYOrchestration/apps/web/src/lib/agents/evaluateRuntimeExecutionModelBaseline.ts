/**
 * Stage 6-A runtime execution model baseline (read-only; no actual execution).
 */

import { evaluateStage5IntegratedKnowledgeFoundationClosure } from "@/lib/agents/evaluateStage5IntegratedKnowledgeFoundationClosure";
import type {
  RuntimeExecutionModelBaselineFinding,
  RuntimeExecutionModelBaselineInput,
  RuntimeExecutionModelBaselineReport,
} from "@/lib/agents/runtimeExecutionModelBaselineTypes";
import {
  appendRuntimeExecutionModelBaselineFindings,
  buildRuntimeExecutionModelBaselineChecklists,
  buildRuntimeExecutionModelBaselineFingerprint,
  buildRuntimeExecutionModelBaselineSummary,
  DEFAULT_RUNTIME_EXECUTION_BOUNDARIES,
  findUnknownExecutionUnitKinds,
  MODEL_BASELINE_TITLE,
  MODEL_BASELINE_VERSION,
  parseRuntimeExecutionModelBaselineInput,
  REQUIRED_STAGE6_A_MODEL_BASELINE_CONFIRMATIONS,
  resolveRuntimeExecutionModelBaselineDecision,
  STAGE6_A_RECOMMENDED_NEXT_PHASES,
  STAGE6_A_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionModelBaselineSupport";

export {
  DEFAULT_RUNTIME_EXECUTION_UNIT_KINDS,
  REQUIRED_STAGE6_A_MODEL_BASELINE_CONFIRMATIONS,
  STAGE6_A_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionModelBaselineConstants";

export {
  buildStage6AModelBaselineConfirmedInput,
  buildStage6AReadyBaselineInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export {
  resolveRuntimeExecutionModelBaselineDecision,
  uniqueRuntimeExecutionUnitKinds,
} from "@/lib/agents/runtimeExecutionModelBaselineSupport";

export type { RuntimeExecutionModelBaselineDecisionInput } from "@/lib/agents/runtimeExecutionModelBaselineTypes";

/** Read-only Stage 6-A baseline — uses Stage 5-F as source; does not execute runtime. */
export function evaluateRuntimeExecutionModelBaseline(
  input?: RuntimeExecutionModelBaselineInput,
): RuntimeExecutionModelBaselineReport {
  const stage5Report = evaluateStage5IntegratedKnowledgeFoundationClosure(input?.stage5Closure);
  const parsed = parseRuntimeExecutionModelBaselineInput(input);
  const unknownUnitKinds = findUnknownExecutionUnitKinds(parsed.executionUnitKinds);

  const decision = resolveRuntimeExecutionModelBaselineDecision({
    sourceStage5Decision: stage5Report.decision,
    sourceStage6EntryMode: stage5Report.stage6EntryMode,
    sourceStage6ActualRuntimeExecutionAllowed: stage5Report.stage6ActualRuntimeExecutionAllowed,
    sourceStage6RequiresSeparateApproval: stage5Report.stage6RequiresSeparateApproval,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    hasUnknownExecutionUnitKind: unknownUnitKinds.length > 0,
  });

  const modelBaselineFingerprint = buildRuntimeExecutionModelBaselineFingerprint({
    sourceStage5Decision: stage5Report.decision,
    executionUnitKinds: parsed.executionUnitKinds,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const { confirmationChecklist, boundaryChecklist } = buildRuntimeExecutionModelBaselineChecklists({
    parsed,
    sourceStage5Decision: stage5Report.decision,
    sourceStage6EntryMode: stage5Report.stage6EntryMode,
    sourceStage6RequiresSeparateApproval: stage5Report.stage6RequiresSeparateApproval,
  });

  const findings: RuntimeExecutionModelBaselineFinding[] = [];
  appendRuntimeExecutionModelBaselineFindings({
    findings,
    decision,
    parsed,
    sourceStage5Decision: stage5Report.decision,
    unknownUnitKinds,
  });

  return {
    mode: "read_only_runtime_execution_model_baseline",
    stage: "stage_6_a_runtime_execution_model_baseline",
    decision,
    sourceStage5Decision: stage5Report.decision,
    sourceStage6EntryCandidate: stage5Report.stage6EntryCandidate,
    sourceStage6EntryMode: stage5Report.stage6EntryMode,
    sourceStage6ActualRuntimeExecutionAllowed: stage5Report.stage6ActualRuntimeExecutionAllowed,
    sourceStage6RequiresSeparateApproval: stage5Report.stage6RequiresSeparateApproval,
    modelBaselineVersion: MODEL_BASELINE_VERSION,
    modelBaselineTitle: MODEL_BASELINE_TITLE,
    modelBaselineSummary: buildRuntimeExecutionModelBaselineSummary(decision),
    modelBaselineFingerprint,
    executionModelDesignOnly: true,
    actualRuntimeExecutionAllowedInThisStep: false,
    actualConnectorRoutingChangeAllowedInThisStep: false,
    actualCursorExecutionAllowedInThisStep: false,
    actualGithubOperationAllowedInThisStep: false,
    actualDbWriteAllowedInThisStep: false,
    actualFeatureFlagWireAllowedInThisStep: false,
    executionUnitKinds: parsed.executionUnitKinds,
    unknownExecutionUnitKinds: unknownUnitKinds,
    executionUnitKindInputNormalized: parsed.executionUnitKindInputNormalized,
    executionUnitKindDuplicateRemovedCount: parsed.executionUnitKindDuplicateRemovedCount,
    executionBoundaries: [...DEFAULT_RUNTIME_EXECUTION_BOUNDARIES],
    requiredConfirmations: [...REQUIRED_STAGE6_A_MODEL_BASELINE_CONFIRMATIONS],
    confirmationChecklist,
    boundaryChecklist,
    findings,
    recommendedNextPhases: [...STAGE6_A_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE6_A_SEPARATED_WORK_ITEMS],
  };
}
