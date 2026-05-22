/**
 * Stage 9-A runtime execution API MVP support (read-only).
 */

import { evaluateRuntimeControlBundle } from "@/lib/agents/evaluateRuntimeControlBundle";
import { buildRuntimeExecutionApiMvpChecklists } from "@/lib/agents/runtimeExecutionApiMvpChecklists";
import {
  parseRuntimeExecutionApiMvpInput,
  resolveRuntimeExecutionApiMvpDecision,
} from "@/lib/agents/runtimeExecutionApiMvpDecision";
import { appendRuntimeExecutionApiMvpFindings } from "@/lib/agents/runtimeExecutionApiMvpFindings";
import {
  buildRuntimeExecutionApiMvpFingerprint,
  buildRuntimeExecutionApiMvpSummary,
} from "@/lib/agents/runtimeExecutionApiMvpFingerprint";
import type { RuntimeExecutionApiMvpInput } from "@/lib/agents/runtimeExecutionApiMvpTypes";
import type { RuntimeControlBundleReport } from "@/lib/agents/runtimeControlBundleTypes";

export { computeStage9AClosureReady } from "@/lib/agents/runtimeExecutionApiMvpClosureReady";

export {
  REQUIRED_STAGE9_A_CONFIRMATIONS,
  RUNTIME_EXECUTION_API_MVP_TITLE,
  RUNTIME_EXECUTION_API_MVP_VERSION,
  STAGE9_A_ENDPOINT_CONTRACTS,
  STAGE9_A_RECOMMENDED_NEXT_PHASES,
  STAGE9_A_SEPARATED_WORK_ITEMS,
  STAGE9_A_SUPPORTED_ACTIONS,
} from "@/lib/agents/runtimeExecutionApiMvpConstants";

export {
  parseRuntimeExecutionApiMvpInput,
  resolveRuntimeExecutionApiMvpDecision,
} from "@/lib/agents/runtimeExecutionApiMvpDecision";

export {
  buildRuntimeExecutionApiMvpFingerprint,
  buildRuntimeExecutionApiMvpSummary,
} from "@/lib/agents/runtimeExecutionApiMvpFingerprint";

export { buildRuntimeExecutionApiMvpChecklists } from "@/lib/agents/runtimeExecutionApiMvpChecklists";
export { appendRuntimeExecutionApiMvpFindings } from "@/lib/agents/runtimeExecutionApiMvpFindings";

export function evaluateRuntimeExecutionApiMvpSource(
  input?: RuntimeExecutionApiMvpInput,
): RuntimeControlBundleReport {
  return evaluateRuntimeControlBundle(input?.runtimeControlBundle);
}
