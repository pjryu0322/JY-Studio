/**
 * Stage 11-A external execution adapter dry-run package (read-only).
 */

import type {
  ExternalExecutionDryRunPackageFinding,
  ExternalExecutionDryRunPackageInput,
  ExternalExecutionDryRunPackageReport,
} from "@/lib/agents/externalExecutionDryRunPackageTypes";
import {
  EXTERNAL_EXECUTION_DRY_RUN_PACKAGE_TITLE,
  EXTERNAL_EXECUTION_DRY_RUN_PACKAGE_VERSION,
  REQUIRED_STAGE11_A_CONFIRMATIONS,
  STAGE11_A_RECOMMENDED_NEXT_PHASES,
  STAGE11_A_SEPARATED_WORK_ITEMS,
  STAGE12_ENTRY_OUT_OF_SCOPE,
  STAGE12_ENTRY_SCOPE,
} from "@/lib/agents/externalExecutionDryRunPackageConstants";
import { appendExternalExecutionDryRunPackageFindings } from "@/lib/agents/externalExecutionDryRunPackageFindings";
import { buildExternalExecutionDryRunPackageChecklists } from "@/lib/agents/externalExecutionDryRunPackageChecklists";
import {
  buildExternalExecutionDryRunPackageFingerprint,
  buildExternalExecutionDryRunPackageSummary,
} from "@/lib/agents/externalExecutionDryRunPackageFingerprint";
import { buildExternalExecutionDryRunPackageItems } from "@/lib/agents/externalExecutionDryRunPackageItems";
import { parseExternalExecutionDryRunPackageInput } from "@/lib/agents/externalExecutionDryRunPackageDecision";
import { resolveExternalExecutionDryRunPackageDecision } from "@/lib/agents/externalExecutionDryRunPackageDecision";
import { evaluateExternalExecutionDryRunPackageSource } from "@/lib/agents/externalExecutionDryRunPackageSource";
import {
  buildExternalExecutionDryRunPackageManualGateHardeningFields,
  mapExternalExecutionDryRunPackageAgentRegistrySourceTrace,
} from "@/lib/agents/externalExecutionDryRunPackageManualGateTrace";
import {
  buildExternalExecutionDryRunPackageStage12ReportFields,
  mapExternalExecutionDryRunPackageDecisionInputFromSource,
  mapExternalExecutionDryRunPackageSourceTrace,
} from "@/lib/agents/externalExecutionDryRunPackageSourceMapping";
import {
  computeStage12EntryReady,
  validateExternalExecutionDryRunPackageItems,
} from "@/lib/agents/externalExecutionDryRunPackageValidation";

export { resolveExternalExecutionDryRunPackageDecision } from "@/lib/agents/externalExecutionDryRunPackageDecision";
export { buildExternalExecutionDryRunPackageFingerprint } from "@/lib/agents/externalExecutionDryRunPackageFingerprint";

export { buildExternalExecutionDryRunPackageItems } from "@/lib/agents/externalExecutionDryRunPackageItems";
export { validateExternalExecutionDryRunPackageItems } from "@/lib/agents/externalExecutionDryRunPackageValidation";

export {
  buildStage11AReadyExternalExecutionDryRunPackageInput,
  buildStage11AConfirmedExternalExecutionDryRunPackageInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type { ExternalExecutionDryRunPackageDecisionInput } from "@/lib/agents/externalExecutionDryRunPackageTypes";

/** Read-only Stage 11-A dry-run package — does not invoke external execution. */
export function evaluateExternalExecutionDryRunPackage(
  input: ExternalExecutionDryRunPackageInput = {},
): ExternalExecutionDryRunPackageReport {
  const source = evaluateExternalExecutionDryRunPackageSource(input);
  const parsed = parseExternalExecutionDryRunPackageInput(input);
  const dryRunItems = buildExternalExecutionDryRunPackageItems(source);
  const validation = validateExternalExecutionDryRunPackageItems(dryRunItems);
  const stage12EntryReady = computeStage12EntryReady(dryRunItems, validation);

  const decision = resolveExternalExecutionDryRunPackageDecision(
    mapExternalExecutionDryRunPackageDecisionInputFromSource(source, {
      validationValid: validation.valid,
      stage12EntryReady,
      confirmationsSatisfied: parsed.confirmationsSatisfied,
    }),
  );

  const { checklist, boundaryChecklist } = buildExternalExecutionDryRunPackageChecklists({
    sourceStage10Decision: source.decision,
    sourceStage11EntryReady: source.stage11EntryReady,
    validationValid: validation.valid,
    stage12EntryReady,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const findings: ExternalExecutionDryRunPackageFinding[] = [];
  appendExternalExecutionDryRunPackageFindings({
    findings,
    decision,
    source,
    validation,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    stage12EntryReady,
  });

  const packageFingerprint = buildExternalExecutionDryRunPackageFingerprint({
    sourceStage10Decision: source.decision,
    sourceStage11EntryReady: source.stage11EntryReady,
    itemCount: dryRunItems.length,
    stage12CandidateItemCount: dryRunItems.filter((item) => item.stage12Candidate).length,
    requiredBeforeStage12ItemCount: dryRunItems.filter((item) => item.requiredBeforeStage12).length,
    confirmationCount: parsed.confirmationCount,
  });

  return {
    mode: "read_only_external_execution_dry_run_package",
    stage: "stage_11_a_external_execution_adapter_dry_run_package",
    decision,
    ...mapExternalExecutionDryRunPackageSourceTrace(source),
    ...mapExternalExecutionDryRunPackageAgentRegistrySourceTrace(source),
    ...buildExternalExecutionDryRunPackageManualGateHardeningFields(),
    packageVersion: EXTERNAL_EXECUTION_DRY_RUN_PACKAGE_VERSION,
    packageTitle: EXTERNAL_EXECUTION_DRY_RUN_PACKAGE_TITLE,
    packageSummary: buildExternalExecutionDryRunPackageSummary(decision),
    packageFingerprint,
    ...buildExternalExecutionDryRunPackageStage12ReportFields({ stage12EntryReady }),
    stage12EntryScope: [...STAGE12_ENTRY_SCOPE],
    stage12EntryOutOfScope: [...STAGE12_ENTRY_OUT_OF_SCOPE],
    dryRunItems,
    validation,
    requiredConfirmations: [...REQUIRED_STAGE11_A_CONFIRMATIONS],
    checklist,
    boundaryChecklist,
    findings,
    itemCount: dryRunItems.length,
    stage12CandidateItemCount: dryRunItems.filter((item) => item.stage12Candidate).length,
    requiredBeforeStage12ItemCount: dryRunItems.filter((item) => item.requiredBeforeStage12).length,
    recommendedNextPhases: [...STAGE11_A_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE11_A_SEPARATED_WORK_ITEMS],
  };
}
