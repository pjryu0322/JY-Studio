/**
 * Stage 13-A actual external execution adapter candidate boundary (read-only).
 */

import {
  ACTUAL_EXTERNAL_EXECUTION_ADAPTER_CANDIDATE_TITLE,
  ACTUAL_EXTERNAL_EXECUTION_ADAPTER_CANDIDATE_VERSION,
  REQUIRED_STAGE13_A_CONFIRMATIONS,
  STAGE13_A_RECOMMENDED_NEXT_PHASES,
  STAGE13_A_SEPARATED_WORK_ITEMS,
  STAGE14_ENTRY_OUT_OF_SCOPE,
  STAGE14_ENTRY_SCOPE,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateConstants";
import { appendActualExternalExecutionAdapterCandidateFindings } from "@/lib/agents/actualExternalExecutionAdapterCandidateFindings";
import { buildActualExternalExecutionAdapterCandidateChecklists } from "@/lib/agents/actualExternalExecutionAdapterCandidateChecklists";
import {
  buildActualExternalExecutionAdapterCandidateFingerprint,
  buildActualExternalExecutionAdapterCandidateSummary,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateFingerprint";
import { buildActualExternalExecutionAdapterCandidateItems } from "@/lib/agents/actualExternalExecutionAdapterCandidateItems";
import {
  parseActualExternalExecutionAdapterCandidateInput,
  resolveActualExternalExecutionAdapterCandidateDecision,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateDecision";
import { evaluateActualExternalExecutionAdapterCandidateSource } from "@/lib/agents/actualExternalExecutionAdapterCandidateSource";
import {
  buildActualExternalExecutionAdapterCandidateStage14ReportFields,
  mapActualExternalExecutionAdapterCandidateDecisionInputFromSource,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateSourceMapping";
import { mapActualExternalExecutionAdapterCandidateSourceTrace } from "@/lib/agents/actualExternalExecutionAdapterCandidateSourceTrace";
import {
  computeStage14EntryReady,
  validateActualExternalExecutionAdapterCandidateItems,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateValidation";
import type {
  ActualExternalExecutionAdapterCandidateFinding,
  ActualExternalExecutionAdapterCandidateInput,
  ActualExternalExecutionAdapterCandidateReport,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";

export { resolveActualExternalExecutionAdapterCandidateDecision } from "@/lib/agents/actualExternalExecutionAdapterCandidateDecision";
export { buildActualExternalExecutionAdapterCandidateFingerprint } from "@/lib/agents/actualExternalExecutionAdapterCandidateFingerprint";

export { buildActualExternalExecutionAdapterCandidateItems } from "@/lib/agents/actualExternalExecutionAdapterCandidateItems";
export { validateActualExternalExecutionAdapterCandidateItems } from "@/lib/agents/actualExternalExecutionAdapterCandidateValidation";

export {
  buildStage13AReadyActualExternalExecutionAdapterCandidateInput,
  buildStage13AConfirmedActualExternalExecutionAdapterCandidateInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type { ActualExternalExecutionAdapterCandidateDecisionInput } from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";

/** Read-only Stage 13-A adapter candidate boundary — does not invoke external execution. */
export function evaluateActualExternalExecutionAdapterCandidate(
  input: ActualExternalExecutionAdapterCandidateInput = {},
): ActualExternalExecutionAdapterCandidateReport {
  const source = evaluateActualExternalExecutionAdapterCandidateSource(input);
  const parsed = parseActualExternalExecutionAdapterCandidateInput(input);
  const candidateItems = buildActualExternalExecutionAdapterCandidateItems(source);
  const validation = validateActualExternalExecutionAdapterCandidateItems(candidateItems);
  const stage14EntryReady = computeStage14EntryReady(candidateItems, validation);

  const decision = resolveActualExternalExecutionAdapterCandidateDecision(
    mapActualExternalExecutionAdapterCandidateDecisionInputFromSource(source, {
      validationValid: validation.valid,
      stage14EntryReady,
      confirmationsSatisfied: parsed.confirmationsSatisfied,
    }),
  );

  const { checklist, boundaryChecklist } = buildActualExternalExecutionAdapterCandidateChecklists({
    sourceStage12Decision: source.decision,
    sourceStage13EntryReady: source.stage13EntryReady,
    validationValid: validation.valid,
    stage14EntryReady,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const findings: ActualExternalExecutionAdapterCandidateFinding[] = [];
  appendActualExternalExecutionAdapterCandidateFindings({
    findings,
    decision,
    source,
    validation,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    stage14EntryReady,
  });

  const candidateFingerprint = buildActualExternalExecutionAdapterCandidateFingerprint({
    sourceStage12Decision: source.decision,
    sourceStage13EntryReady: source.stage13EntryReady,
    itemCount: candidateItems.length,
    stage14CandidateItemCount: candidateItems.filter((item) => item.stage14Candidate).length,
    requiredBeforeStage14ItemCount: candidateItems.filter((item) => item.requiredBeforeStage14).length,
    confirmationCount: parsed.confirmationCount,
  });

  return {
    mode: "read_only_actual_external_execution_adapter_candidate_boundary",
    stage: "stage_13_a_actual_external_execution_adapter_candidate_boundary",
    decision,
    ...mapActualExternalExecutionAdapterCandidateSourceTrace(source),
    candidateVersion: ACTUAL_EXTERNAL_EXECUTION_ADAPTER_CANDIDATE_VERSION,
    candidateTitle: ACTUAL_EXTERNAL_EXECUTION_ADAPTER_CANDIDATE_TITLE,
    candidateSummary: buildActualExternalExecutionAdapterCandidateSummary(decision),
    candidateFingerprint,
    ...buildActualExternalExecutionAdapterCandidateStage14ReportFields({ stage14EntryReady }),
    stage14EntryScope: [...STAGE14_ENTRY_SCOPE],
    stage14EntryOutOfScope: [...STAGE14_ENTRY_OUT_OF_SCOPE],
    candidateItems,
    validation,
    requiredConfirmations: [...REQUIRED_STAGE13_A_CONFIRMATIONS],
    checklist,
    boundaryChecklist,
    findings,
    itemCount: candidateItems.length,
    stage14CandidateItemCount: candidateItems.filter((item) => item.stage14Candidate).length,
    requiredBeforeStage14ItemCount: candidateItems.filter((item) => item.requiredBeforeStage14).length,
    recommendedNextPhases: [...STAGE13_A_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE13_A_SEPARATED_WORK_ITEMS],
  };
}
