/**
 * Stage 12-A manual dry-run gate source evaluator (read-only).
 */

import { evaluateExternalExecutionDryRunPackage } from "@/lib/agents/evaluateExternalExecutionDryRunPackage";
import type { ExternalExecutionDryRunPackageReport } from "@/lib/agents/externalExecutionDryRunPackageTypes";
import type { ExternalExecutionManualDryRunGateInput } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

export function evaluateExternalExecutionManualDryRunGateSource(
  input?: ExternalExecutionManualDryRunGateInput,
): ExternalExecutionDryRunPackageReport {
  return evaluateExternalExecutionDryRunPackage(input?.dryRunPackage);
}
