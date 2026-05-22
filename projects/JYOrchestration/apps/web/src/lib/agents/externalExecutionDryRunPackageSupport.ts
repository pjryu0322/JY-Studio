/**
 * Stage 11-A external execution dry-run package support (read-only).
 */

export { evaluateExternalExecutionDryRunPackageSource } from "@/lib/agents/externalExecutionDryRunPackageSource";

export { isSourceReadyForExternalExecutionDryRunPackage } from "@/lib/agents/externalExecutionDryRunPackageItemSource";

export { buildExternalExecutionDryRunPackageItems } from "@/lib/agents/externalExecutionDryRunPackageItems";

export {
  validateExternalExecutionDryRunPackageItems,
  computeStage12EntryReady,
} from "@/lib/agents/externalExecutionDryRunPackageValidation";

export {
  parseExternalExecutionDryRunPackageInput,
  resolveExternalExecutionDryRunPackageDecision,
} from "@/lib/agents/externalExecutionDryRunPackageDecision";

export {
  buildExternalExecutionDryRunPackageFingerprint,
  buildExternalExecutionDryRunPackageSummary,
} from "@/lib/agents/externalExecutionDryRunPackageFingerprint";

export { buildExternalExecutionDryRunPackageChecklists } from "@/lib/agents/externalExecutionDryRunPackageChecklists";

export { appendExternalExecutionDryRunPackageFindings } from "@/lib/agents/externalExecutionDryRunPackageFindings";

export {
  mapExternalExecutionDryRunPackageDecisionInputFromSource,
  mapExternalExecutionDryRunPackageSourceTrace,
  buildExternalExecutionDryRunPackageStage12ReportFields,
  STAGE12_ENTRY_CANDIDATE,
} from "@/lib/agents/externalExecutionDryRunPackageSourceMapping";

export {
  EXTERNAL_EXECUTION_DRY_RUN_PACKAGE_VERSION,
  EXTERNAL_EXECUTION_DRY_RUN_PACKAGE_TITLE,
  REQUIRED_STAGE11_A_CONFIRMATIONS,
  STAGE12_ENTRY_SCOPE,
  STAGE12_ENTRY_OUT_OF_SCOPE,
  STAGE11_A_RECOMMENDED_NEXT_PHASES,
  STAGE11_A_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/externalExecutionDryRunPackageConstants";
