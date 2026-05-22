/**
 * Stage 10-A external execution adapter boundary support (read-only).
 */

import { evaluateRuntimeExecutionMvpClosure } from "@/lib/agents/evaluateRuntimeExecutionMvpClosure";
import { buildExternalExecutionAdapterBoundaryChecklists } from "@/lib/agents/externalExecutionAdapterBoundaryChecklists";
import {
  parseExternalExecutionAdapterBoundaryInput,
  resolveExternalExecutionAdapterBoundaryDecision,
} from "@/lib/agents/externalExecutionAdapterBoundaryDecision";
import { appendExternalExecutionAdapterBoundaryFindings } from "@/lib/agents/externalExecutionAdapterBoundaryFindings";
import {
  buildExternalExecutionAdapterBoundaryFingerprint,
  buildExternalExecutionAdapterBoundarySummary,
} from "@/lib/agents/externalExecutionAdapterBoundaryFingerprint";
import { buildExternalExecutionAdapterBoundaryItems } from "@/lib/agents/externalExecutionAdapterBoundaryItems";
import {
  computeStage11EntryReady,
  validateExternalExecutionAdapterBoundaryItems,
} from "@/lib/agents/externalExecutionAdapterBoundaryValidation";
import type { ExternalExecutionAdapterBoundaryInput } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";
import type { RuntimeExecutionMvpClosureReport } from "@/lib/agents/runtimeExecutionMvpClosureTypes";

export { buildExternalExecutionAdapterBoundaryItems } from "@/lib/agents/externalExecutionAdapterBoundaryItems";
export {
  validateExternalExecutionAdapterBoundaryItems,
  computeStage11EntryReady,
} from "@/lib/agents/externalExecutionAdapterBoundaryValidation";
export {
  parseExternalExecutionAdapterBoundaryInput,
  resolveExternalExecutionAdapterBoundaryDecision,
} from "@/lib/agents/externalExecutionAdapterBoundaryDecision";
export {
  buildExternalExecutionAdapterBoundaryFingerprint,
  buildExternalExecutionAdapterBoundarySummary,
} from "@/lib/agents/externalExecutionAdapterBoundaryFingerprint";
export { buildExternalExecutionAdapterBoundaryChecklists } from "@/lib/agents/externalExecutionAdapterBoundaryChecklists";
export { appendExternalExecutionAdapterBoundaryFindings } from "@/lib/agents/externalExecutionAdapterBoundaryFindings";

export {
  EXTERNAL_EXECUTION_ADAPTER_BOUNDARY_VERSION,
  EXTERNAL_EXECUTION_ADAPTER_BOUNDARY_TITLE,
  REQUIRED_STAGE10_A_CONFIRMATIONS,
  STAGE11_ENTRY_SCOPE,
  STAGE11_ENTRY_OUT_OF_SCOPE,
  STAGE10_A_RECOMMENDED_NEXT_PHASES,
  STAGE10_A_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/externalExecutionAdapterBoundaryConstants";

export function evaluateExternalExecutionAdapterBoundarySource(
  input?: ExternalExecutionAdapterBoundaryInput,
): RuntimeExecutionMvpClosureReport {
  return evaluateRuntimeExecutionMvpClosure(input?.runtimeMvpClosure);
}
