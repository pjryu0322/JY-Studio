/**
 * Stage 13-A adapter candidate source evaluator (read-only).
 */

import { evaluateExternalExecutionManualDryRunGate } from "@/lib/agents/evaluateExternalExecutionManualDryRunGate";
import type { ActualExternalExecutionAdapterCandidateInput } from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";
import type { ExternalExecutionManualDryRunGateReport } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

export function evaluateActualExternalExecutionAdapterCandidateSource(
  input?: ActualExternalExecutionAdapterCandidateInput,
): ExternalExecutionManualDryRunGateReport {
  return evaluateExternalExecutionManualDryRunGate(input?.manualDryRunGate);
}
