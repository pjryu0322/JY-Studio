/**
 * Stage 8-B runtime control bundle support (read-only).
 */

import { evaluateRuntimeExecutionVerticalSlice } from "@/lib/agents/evaluateRuntimeExecutionVerticalSlice";
import { buildRuntimeControlBundleChecklists } from "@/lib/agents/runtimeControlBundleChecklists";
import {
  parseRuntimeControlBundleInput,
  resolveRuntimeControlBundleDecision,
} from "@/lib/agents/runtimeControlBundleDecision";
import { appendRuntimeControlBundleFindings } from "@/lib/agents/runtimeControlBundleFindings";
import {
  buildRuntimeControlBundleFingerprint,
  buildRuntimeControlBundleSummary,
} from "@/lib/agents/runtimeControlBundleFingerprint";
import { buildRuntimeControlBundleItems } from "@/lib/agents/runtimeControlBundleItems";
import {
  computeStage9EntryReady,
  validateRuntimeControlBundleItems,
} from "@/lib/agents/runtimeControlBundleValidation";
import type { RuntimeExecutionVerticalSliceReport } from "@/lib/agents/runtimeExecutionVerticalSliceTypes";
import type { RuntimeControlBundleInput } from "@/lib/agents/runtimeControlBundleTypes";

export { buildRuntimeControlBundleItems } from "@/lib/agents/runtimeControlBundleItems";
export {
  validateRuntimeControlBundleItems,
  computeStage9EntryReady,
} from "@/lib/agents/runtimeControlBundleValidation";
export {
  parseRuntimeControlBundleInput,
  resolveRuntimeControlBundleDecision,
} from "@/lib/agents/runtimeControlBundleDecision";
export {
  buildRuntimeControlBundleFingerprint,
  buildRuntimeControlBundleSummary,
} from "@/lib/agents/runtimeControlBundleFingerprint";

export { buildRuntimeControlBundleChecklists } from "@/lib/agents/runtimeControlBundleChecklists";
export { appendRuntimeControlBundleFindings } from "@/lib/agents/runtimeControlBundleFindings";

export {
  REQUIRED_STAGE8_B_CONFIRMATIONS,
  RUNTIME_CONTROL_BUNDLE_TITLE,
  RUNTIME_CONTROL_BUNDLE_VERSION,
  STAGE8_B_RECOMMENDED_NEXT_PHASES,
  STAGE8_B_SEPARATED_WORK_ITEMS,
  STAGE9_ENTRY_SCOPE,
  STAGE9_ENTRY_OUT_OF_SCOPE,
} from "@/lib/agents/runtimeControlBundleConstants";

export function evaluateRuntimeControlBundleSource(
  input?: RuntimeControlBundleInput,
): RuntimeExecutionVerticalSliceReport {
  return evaluateRuntimeExecutionVerticalSlice(input?.verticalSlice);
}
