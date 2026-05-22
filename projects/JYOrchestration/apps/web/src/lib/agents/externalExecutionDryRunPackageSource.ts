/**
 * Stage 11-A dry-run package source evaluator (read-only).
 */

import { evaluateExternalExecutionAdapterBoundary } from "@/lib/agents/evaluateExternalExecutionAdapterBoundary";
import type { ExternalExecutionAdapterBoundaryReport } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";
import type { ExternalExecutionDryRunPackageInput } from "@/lib/agents/externalExecutionDryRunPackageTypes";

export function evaluateExternalExecutionDryRunPackageSource(
  input?: ExternalExecutionDryRunPackageInput,
): ExternalExecutionAdapterBoundaryReport {
  return evaluateExternalExecutionAdapterBoundary(input?.adapterBoundary);
}
