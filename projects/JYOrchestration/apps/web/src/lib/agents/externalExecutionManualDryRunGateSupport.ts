/**
 * Stage 12-A manual dry-run gate support (read-only).
 */

export { evaluateExternalExecutionManualDryRunGateSource } from "@/lib/agents/externalExecutionManualDryRunGateSource";

export { isSourceReadyForExternalExecutionManualDryRunGate } from "@/lib/agents/externalExecutionManualDryRunGateItemSource";

export { buildExternalExecutionManualDryRunGateItems } from "@/lib/agents/externalExecutionManualDryRunGateItems";

export {
  validateExternalExecutionManualDryRunGateItems,
  computeStage13EntryReady,
} from "@/lib/agents/externalExecutionManualDryRunGateValidation";

export {
  parseExternalExecutionManualDryRunGateInput,
  resolveExternalExecutionManualDryRunGateDecision,
} from "@/lib/agents/externalExecutionManualDryRunGateDecision";

export {
  buildExternalExecutionManualDryRunGateFingerprint,
  buildExternalExecutionManualDryRunGateSummary,
} from "@/lib/agents/externalExecutionManualDryRunGateFingerprint";

export { buildExternalExecutionManualDryRunGateChecklists } from "@/lib/agents/externalExecutionManualDryRunGateChecklists";

export { appendExternalExecutionManualDryRunGateFindings } from "@/lib/agents/externalExecutionManualDryRunGateFindings";

export {
  mapExternalExecutionManualDryRunGateDecisionInputFromSource,
  buildExternalExecutionManualDryRunGateStage13ReportFields,
  STAGE13_ENTRY_CANDIDATE,
} from "@/lib/agents/externalExecutionManualDryRunGateSourceMapping";

export {
  mapExternalExecutionManualDryRunGateSourceTrace,
  mapExternalExecutionManualDryRunGateActualExecutionBoundaryTrace,
} from "@/lib/agents/externalExecutionManualDryRunGateSourceTrace";

export {
  EXTERNAL_EXECUTION_MANUAL_DRY_RUN_GATE_VERSION,
  EXTERNAL_EXECUTION_MANUAL_DRY_RUN_GATE_TITLE,
  REQUIRED_STAGE12_A_CONFIRMATIONS,
  STAGE13_ENTRY_SCOPE,
  STAGE13_ENTRY_OUT_OF_SCOPE,
  STAGE12_A_RECOMMENDED_NEXT_PHASES,
  STAGE12_A_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/externalExecutionManualDryRunGateConstants";
