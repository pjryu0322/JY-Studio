/**
 * Stage 10-A integrated external execution adapter boundary design (read-only).
 */

import type {
  ExternalExecutionAdapterBoundaryFinding,
  ExternalExecutionAdapterBoundaryInput,
  ExternalExecutionAdapterBoundaryReport,
} from "@/lib/agents/externalExecutionAdapterBoundaryTypes";
import {
  EXTERNAL_EXECUTION_ADAPTER_BOUNDARY_TITLE,
  EXTERNAL_EXECUTION_ADAPTER_BOUNDARY_VERSION,
  REQUIRED_STAGE10_A_CONFIRMATIONS,
  STAGE10_A_RECOMMENDED_NEXT_PHASES,
  STAGE10_A_SEPARATED_WORK_ITEMS,
  STAGE11_ENTRY_OUT_OF_SCOPE,
  STAGE11_ENTRY_SCOPE,
} from "@/lib/agents/externalExecutionAdapterBoundaryConstants";
import { appendExternalExecutionAdapterBoundaryFindings } from "@/lib/agents/externalExecutionAdapterBoundaryFindings";
import { buildExternalExecutionAdapterBoundaryChecklists } from "@/lib/agents/externalExecutionAdapterBoundaryChecklists";
import {
  buildExternalExecutionAdapterBoundaryFingerprint,
  buildExternalExecutionAdapterBoundarySummary,
} from "@/lib/agents/externalExecutionAdapterBoundaryFingerprint";
import { buildExternalExecutionAdapterBoundaryItems } from "@/lib/agents/externalExecutionAdapterBoundaryItems";
import { parseExternalExecutionAdapterBoundaryInput } from "@/lib/agents/externalExecutionAdapterBoundaryDecision";
import { resolveExternalExecutionAdapterBoundaryDecision } from "@/lib/agents/externalExecutionAdapterBoundaryDecision";
import { evaluateExternalExecutionAdapterBoundarySource } from "@/lib/agents/externalExecutionAdapterBoundarySource";
import { buildExternalExecutionAdapterBoundaryDryRunHardeningFields } from "@/lib/agents/externalExecutionAdapterBoundaryDryRunTrace";
import {
  buildExternalExecutionAdapterBoundaryStage11ReportFields,
  mapExternalExecutionAdapterBoundaryDecisionInputFromSource,
} from "@/lib/agents/externalExecutionAdapterBoundarySourceMapping";
import {
  computeStage11EntryReady,
  validateExternalExecutionAdapterBoundaryItems,
} from "@/lib/agents/externalExecutionAdapterBoundaryValidation";

export { resolveExternalExecutionAdapterBoundaryDecision } from "@/lib/agents/externalExecutionAdapterBoundaryDecision";
export { buildExternalExecutionAdapterBoundaryFingerprint } from "@/lib/agents/externalExecutionAdapterBoundaryFingerprint";

export { buildExternalExecutionAdapterBoundaryItems } from "@/lib/agents/externalExecutionAdapterBoundaryItems";
export { validateExternalExecutionAdapterBoundaryItems } from "@/lib/agents/externalExecutionAdapterBoundaryValidation";

export {
  buildStage10AReadyExternalExecutionAdapterBoundaryInput,
  buildStage10AConfirmedExternalExecutionAdapterBoundaryInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type { ExternalExecutionAdapterBoundaryDecisionInput } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";

/** Read-only Stage 10-A adapter boundary design — does not grant external execution permission. */
export function evaluateExternalExecutionAdapterBoundary(
  input: ExternalExecutionAdapterBoundaryInput = {},
): ExternalExecutionAdapterBoundaryReport {
  const source = evaluateExternalExecutionAdapterBoundarySource(input);
  const parsed = parseExternalExecutionAdapterBoundaryInput(input);
  const boundaryItems = buildExternalExecutionAdapterBoundaryItems(source);
  const validation = validateExternalExecutionAdapterBoundaryItems(boundaryItems);
  const stage11EntryReady = computeStage11EntryReady(boundaryItems, validation);

  const decision = resolveExternalExecutionAdapterBoundaryDecision(
    mapExternalExecutionAdapterBoundaryDecisionInputFromSource(source, {
      validationValid: validation.valid,
      stage11EntryReady,
      confirmationsSatisfied: parsed.confirmationsSatisfied,
    }),
  );

  const { checklist, boundaryChecklist } = buildExternalExecutionAdapterBoundaryChecklists({
    sourceStage9Decision: source.decision,
    sourceStage10EntryReady: source.stage10EntryReady,
    validationValid: validation.valid,
    stage11EntryReady,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const findings: ExternalExecutionAdapterBoundaryFinding[] = [];
  appendExternalExecutionAdapterBoundaryFindings({
    findings,
    decision,
    source,
    validation,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    stage11EntryReady,
  });

  const boundaryFingerprint = buildExternalExecutionAdapterBoundaryFingerprint({
    sourceStage9Decision: source.decision,
    sourceStage10EntryReady: source.stage10EntryReady,
    itemCount: boundaryItems.length,
    stage11CandidateItemCount: boundaryItems.filter((item) => item.stage11Candidate).length,
    requiredBeforeStage11ItemCount: boundaryItems.filter((item) => item.requiredBeforeStage11).length,
    confirmationCount: parsed.confirmationCount,
  });

  return {
    mode: "read_only_external_execution_adapter_boundary_design",
    stage: "stage_10_a_integrated_external_execution_adapter_boundary_design",
    decision,
    sourceStage9Decision: source.decision,
    sourceStage10EntryReady: source.stage10EntryReady,
    sourceStage10EntryMode: source.stage10EntryMode,
    sourceStage10ActualCursorExecutionAllowed: source.stage10ActualCursorExecutionAllowed,
    sourceStage10ActualGithubWriteAllowed: source.stage10ActualGithubWriteAllowed,
    sourceStage10ActualConnectorGatewayCallAllowed: source.stage10ActualConnectorGatewayCallAllowed,
    sourceStage10ActualDbPersistenceAllowed: source.stage10ActualDbPersistenceAllowed,
    sourceStage10ActualProductionRunnerAllowed: source.stage10ActualProductionRunnerAllowed,
    sourceStage10ActualUiImplementationAllowed: source.stage10ActualUiImplementationAllowed,
    boundaryVersion: EXTERNAL_EXECUTION_ADAPTER_BOUNDARY_VERSION,
    boundaryTitle: EXTERNAL_EXECUTION_ADAPTER_BOUNDARY_TITLE,
    boundarySummary: buildExternalExecutionAdapterBoundarySummary(decision),
    boundaryFingerprint,
    ...buildExternalExecutionAdapterBoundaryStage11ReportFields({ stage11EntryReady }),
    ...buildExternalExecutionAdapterBoundaryDryRunHardeningFields({ boundaryItems }),
    stage11EntryScope: [...STAGE11_ENTRY_SCOPE],
    stage11EntryOutOfScope: [...STAGE11_ENTRY_OUT_OF_SCOPE],
    boundaryItems,
    validation,
    requiredConfirmations: [...REQUIRED_STAGE10_A_CONFIRMATIONS],
    checklist,
    boundaryChecklist,
    findings,
    itemCount: boundaryItems.length,
    stage11CandidateItemCount: boundaryItems.filter((item) => item.stage11Candidate).length,
    requiredBeforeStage11ItemCount: boundaryItems.filter((item) => item.requiredBeforeStage11).length,
    recommendedNextPhases: [...STAGE10_A_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE10_A_SEPARATED_WORK_ITEMS],
  };
}
