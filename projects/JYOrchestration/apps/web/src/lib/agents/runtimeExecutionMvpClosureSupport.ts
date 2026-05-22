/**
 * Stage 9-B runtime MVP closure bundle support (read-only).
 */

import { evaluateRuntimeExecutionApiMvp } from "@/lib/agents/evaluateRuntimeExecutionApiMvp";
import { buildRuntimeExecutionMvpClosureChecklists } from "@/lib/agents/runtimeExecutionMvpClosureChecklists";
import {
  parseRuntimeExecutionMvpClosureInput,
  resolveRuntimeExecutionMvpClosureDecision,
} from "@/lib/agents/runtimeExecutionMvpClosureDecision";
import { appendRuntimeExecutionMvpClosureFindings } from "@/lib/agents/runtimeExecutionMvpClosureFindings";
import {
  buildRuntimeExecutionMvpClosureFingerprint,
  buildRuntimeExecutionMvpClosureSummary,
} from "@/lib/agents/runtimeExecutionMvpClosureFingerprint";
import { buildRuntimeExecutionMvpClosureItems } from "@/lib/agents/runtimeExecutionMvpClosureItems";
import {
  computeStage10EntryReady,
  validateRuntimeExecutionMvpClosureItems,
} from "@/lib/agents/runtimeExecutionMvpClosureValidation";
import type { RuntimeExecutionApiMvpReport } from "@/lib/agents/runtimeExecutionApiMvpTypes";
import type { RuntimeExecutionMvpClosureInput } from "@/lib/agents/runtimeExecutionMvpClosureTypes";

export { buildRuntimeExecutionMvpClosureItems } from "@/lib/agents/runtimeExecutionMvpClosureItems";
export {
  validateRuntimeExecutionMvpClosureItems,
  computeStage10EntryReady,
} from "@/lib/agents/runtimeExecutionMvpClosureValidation";
export {
  parseRuntimeExecutionMvpClosureInput,
  resolveRuntimeExecutionMvpClosureDecision,
} from "@/lib/agents/runtimeExecutionMvpClosureDecision";
export {
  buildRuntimeExecutionMvpClosureFingerprint,
  buildRuntimeExecutionMvpClosureSummary,
} from "@/lib/agents/runtimeExecutionMvpClosureFingerprint";
export { buildRuntimeExecutionMvpClosureChecklists } from "@/lib/agents/runtimeExecutionMvpClosureChecklists";
export { appendRuntimeExecutionMvpClosureFindings } from "@/lib/agents/runtimeExecutionMvpClosureFindings";

export {
  REQUIRED_STAGE9_B_CONFIRMATIONS,
  RUNTIME_EXECUTION_MVP_CLOSURE_TITLE,
  RUNTIME_EXECUTION_MVP_CLOSURE_VERSION,
  STAGE10_ENTRY_OUT_OF_SCOPE,
  STAGE10_ENTRY_SCOPE,
  STAGE9_B_RECOMMENDED_NEXT_PHASES,
  STAGE9_B_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionMvpClosureConstants";

export {
  STAGE10_ENTRY_MODE,
  STAGE10_ENTRY_CANDIDATE,
  mapRuntimeExecutionMvpClosureSourceTrace,
  buildRuntimeExecutionMvpClosureStage10ReportFields,
} from "@/lib/agents/runtimeExecutionMvpClosureStage10Trace";

export function evaluateRuntimeExecutionMvpClosureSource(
  input?: RuntimeExecutionMvpClosureInput,
): RuntimeExecutionApiMvpReport {
  return evaluateRuntimeExecutionApiMvp(input?.apiMvp);
}
