/**
 * Stage 12-A external execution adapter manual dry-run gate (read-only).
 */

import type {
  ExternalExecutionManualDryRunGateFinding,
  ExternalExecutionManualDryRunGateInput,
  ExternalExecutionManualDryRunGateReport,
} from "@/lib/agents/externalExecutionManualDryRunGateTypes";
import {
  EXTERNAL_EXECUTION_MANUAL_DRY_RUN_GATE_TITLE,
  EXTERNAL_EXECUTION_MANUAL_DRY_RUN_GATE_VERSION,
  REQUIRED_STAGE12_A_CONFIRMATIONS,
  STAGE12_A_RECOMMENDED_NEXT_PHASES,
  STAGE12_A_SEPARATED_WORK_ITEMS,
  STAGE13_ENTRY_OUT_OF_SCOPE,
  STAGE13_ENTRY_SCOPE,
} from "@/lib/agents/externalExecutionManualDryRunGateConstants";
import { appendExternalExecutionManualDryRunGateFindings } from "@/lib/agents/externalExecutionManualDryRunGateFindings";
import { buildExternalExecutionManualDryRunGateChecklists } from "@/lib/agents/externalExecutionManualDryRunGateChecklists";
import {
  buildExternalExecutionManualDryRunGateFingerprint,
  buildExternalExecutionManualDryRunGateSummary,
} from "@/lib/agents/externalExecutionManualDryRunGateFingerprint";
import { buildExternalExecutionManualDryRunGateItems } from "@/lib/agents/externalExecutionManualDryRunGateItems";
import { parseExternalExecutionManualDryRunGateInput } from "@/lib/agents/externalExecutionManualDryRunGateDecision";
import { resolveExternalExecutionManualDryRunGateDecision } from "@/lib/agents/externalExecutionManualDryRunGateDecision";
import { evaluateExternalExecutionManualDryRunGateSource } from "@/lib/agents/externalExecutionManualDryRunGateSource";
import {
  buildExternalExecutionManualDryRunGateStage13ReportFields,
  mapExternalExecutionManualDryRunGateDecisionInputFromSource,
  mapExternalExecutionManualDryRunGateSourceTrace,
} from "@/lib/agents/externalExecutionManualDryRunGateSourceMapping";
import {
  computeStage13EntryReady,
  validateExternalExecutionManualDryRunGateItems,
} from "@/lib/agents/externalExecutionManualDryRunGateValidation";

export { resolveExternalExecutionManualDryRunGateDecision } from "@/lib/agents/externalExecutionManualDryRunGateDecision";
export { buildExternalExecutionManualDryRunGateFingerprint } from "@/lib/agents/externalExecutionManualDryRunGateFingerprint";

export { buildExternalExecutionManualDryRunGateItems } from "@/lib/agents/externalExecutionManualDryRunGateItems";
export { validateExternalExecutionManualDryRunGateItems } from "@/lib/agents/externalExecutionManualDryRunGateValidation";

export {
  buildStage12AReadyExternalExecutionManualDryRunGateInput,
  buildStage12AConfirmedExternalExecutionManualDryRunGateInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type { ExternalExecutionManualDryRunGateDecisionInput } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

/** Read-only Stage 12-A manual dry-run gate — does not invoke external execution. */
export function evaluateExternalExecutionManualDryRunGate(
  input: ExternalExecutionManualDryRunGateInput = {},
): ExternalExecutionManualDryRunGateReport {
  const source = evaluateExternalExecutionManualDryRunGateSource(input);
  const parsed = parseExternalExecutionManualDryRunGateInput(input);
  const gateItems = buildExternalExecutionManualDryRunGateItems(source);
  const validation = validateExternalExecutionManualDryRunGateItems(gateItems);
  const stage13EntryReady = computeStage13EntryReady(gateItems, validation);

  const decision = resolveExternalExecutionManualDryRunGateDecision(
    mapExternalExecutionManualDryRunGateDecisionInputFromSource(source, {
      validationValid: validation.valid,
      stage13EntryReady,
      confirmationsSatisfied: parsed.confirmationsSatisfied,
    }),
  );

  const { checklist, boundaryChecklist } = buildExternalExecutionManualDryRunGateChecklists({
    sourceStage11Decision: source.decision,
    sourceStage12EntryReady: source.stage12EntryReady,
    validationValid: validation.valid,
    stage13EntryReady,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const findings: ExternalExecutionManualDryRunGateFinding[] = [];
  appendExternalExecutionManualDryRunGateFindings({
    findings,
    decision,
    source,
    validation,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    stage13EntryReady,
  });

  const gateFingerprint = buildExternalExecutionManualDryRunGateFingerprint({
    sourceStage11Decision: source.decision,
    sourceStage12EntryReady: source.stage12EntryReady,
    itemCount: gateItems.length,
    stage13CandidateItemCount: gateItems.filter((item) => item.stage13Candidate).length,
    requiredBeforeStage13ItemCount: gateItems.filter((item) => item.requiredBeforeStage13).length,
    confirmationCount: parsed.confirmationCount,
  });

  return {
    mode: "read_only_external_execution_manual_dry_run_gate",
    stage: "stage_12_a_external_execution_adapter_manual_dry_run_gate",
    decision,
    ...mapExternalExecutionManualDryRunGateSourceTrace(source),
    gateVersion: EXTERNAL_EXECUTION_MANUAL_DRY_RUN_GATE_VERSION,
    gateTitle: EXTERNAL_EXECUTION_MANUAL_DRY_RUN_GATE_TITLE,
    gateSummary: buildExternalExecutionManualDryRunGateSummary(decision),
    gateFingerprint,
    ...buildExternalExecutionManualDryRunGateStage13ReportFields({ stage13EntryReady }),
    stage13EntryScope: [...STAGE13_ENTRY_SCOPE],
    stage13EntryOutOfScope: [...STAGE13_ENTRY_OUT_OF_SCOPE],
    gateItems,
    validation,
    requiredConfirmations: [...REQUIRED_STAGE12_A_CONFIRMATIONS],
    checklist,
    boundaryChecklist,
    findings,
    itemCount: gateItems.length,
    stage13CandidateItemCount: gateItems.filter((item) => item.stage13Candidate).length,
    requiredBeforeStage13ItemCount: gateItems.filter((item) => item.requiredBeforeStage13).length,
    recommendedNextPhases: [...STAGE12_A_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE12_A_SEPARATED_WORK_ITEMS],
  };
}
