/**
 * Stage 13-A adapter candidate support (read-only).
 */

export { evaluateActualExternalExecutionAdapterCandidateSource } from "@/lib/agents/actualExternalExecutionAdapterCandidateSource";

export { isSourceReadyForActualExternalExecutionAdapterCandidate } from "@/lib/agents/actualExternalExecutionAdapterCandidateItemSource";

export { buildActualExternalExecutionAdapterCandidateItems } from "@/lib/agents/actualExternalExecutionAdapterCandidateItems";

export {
  validateActualExternalExecutionAdapterCandidateItems,
  computeStage14EntryReady,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateValidation";

export {
  parseActualExternalExecutionAdapterCandidateInput,
  resolveActualExternalExecutionAdapterCandidateDecision,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateDecision";

export {
  buildActualExternalExecutionAdapterCandidateFingerprint,
  buildActualExternalExecutionAdapterCandidateSummary,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateFingerprint";

export { buildActualExternalExecutionAdapterCandidateChecklists } from "@/lib/agents/actualExternalExecutionAdapterCandidateChecklists";

export { appendActualExternalExecutionAdapterCandidateFindings } from "@/lib/agents/actualExternalExecutionAdapterCandidateFindings";

export {
  mapActualExternalExecutionAdapterCandidateDecisionInputFromSource,
  buildActualExternalExecutionAdapterCandidateStage14ReportFields,
  STAGE14_ENTRY_CANDIDATE,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateSourceMapping";

export {
  mapActualExternalExecutionAdapterCandidateSourceTrace,
  mapActualExternalExecutionAdapterCandidateAdapterImplementationBoundaryTrace,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateSourceTrace";

export {
  ACTUAL_EXTERNAL_EXECUTION_ADAPTER_CANDIDATE_VERSION,
  ACTUAL_EXTERNAL_EXECUTION_ADAPTER_CANDIDATE_TITLE,
  REQUIRED_STAGE13_A_CONFIRMATIONS,
  STAGE14_ENTRY_SCOPE,
  STAGE14_ENTRY_OUT_OF_SCOPE,
  STAGE13_A_RECOMMENDED_NEXT_PHASES,
  STAGE13_A_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateConstants";
