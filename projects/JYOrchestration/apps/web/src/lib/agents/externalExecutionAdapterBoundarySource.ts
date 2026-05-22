/**
 * Stage 10-A adapter boundary source evaluator (read-only).
 */

import { evaluateRuntimeExecutionMvpClosure } from "@/lib/agents/evaluateRuntimeExecutionMvpClosure";
import type { ExternalExecutionAdapterBoundaryInput } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";
import type { RuntimeExecutionMvpClosureReport } from "@/lib/agents/runtimeExecutionMvpClosureTypes";

export function evaluateExternalExecutionAdapterBoundarySource(
  input?: ExternalExecutionAdapterBoundaryInput,
): RuntimeExecutionMvpClosureReport {
  return evaluateRuntimeExecutionMvpClosure(input?.runtimeMvpClosure);
}
