/**
 * Stage 7-C runtime contract bundle closure support (read-only).
 */

import { evaluateRuntimeApiContractDesign } from "@/lib/agents/evaluateRuntimeApiContractDesign";
import { buildRuntimeContractBundleClosureChecklists } from "@/lib/agents/runtimeContractBundleClosureChecklists";
import {
  parseRuntimeContractBundleClosureInput,
  resolveRuntimeContractBundleClosureDecision,
} from "@/lib/agents/runtimeContractBundleClosureDecision";
import { appendRuntimeContractBundleClosureFindings } from "@/lib/agents/runtimeContractBundleClosureFindings";
import {
  buildRuntimeContractBundleClosureFingerprint,
  buildRuntimeContractBundleClosureSummary,
} from "@/lib/agents/runtimeContractBundleClosureFingerprint";
import { buildRuntimeContractBundleItems } from "@/lib/agents/runtimeContractBundleClosureItems";
import {
  computeStage8EntryReady,
  validateRuntimeContractBundleItems,
} from "@/lib/agents/runtimeContractBundleClosureItemValidation";
import type { RuntimeApiContractDesignReport } from "@/lib/agents/runtimeApiContractDesignTypes";
import type { RuntimeContractBundleClosureInput } from "@/lib/agents/runtimeContractBundleClosureTypes";

export { buildRuntimeContractBundleItems } from "@/lib/agents/runtimeContractBundleClosureItems";
export {
  validateRuntimeContractBundleItems,
  computeStage8EntryReady,
} from "@/lib/agents/runtimeContractBundleClosureItemValidation";
export {
  parseRuntimeContractBundleClosureInput,
  resolveRuntimeContractBundleClosureDecision,
} from "@/lib/agents/runtimeContractBundleClosureDecision";
export {
  buildRuntimeContractBundleClosureFingerprint,
  buildRuntimeContractBundleClosureSummary,
} from "@/lib/agents/runtimeContractBundleClosureFingerprint";

export { buildRuntimeContractBundleClosureChecklists } from "@/lib/agents/runtimeContractBundleClosureChecklists";
export { appendRuntimeContractBundleClosureFindings } from "@/lib/agents/runtimeContractBundleClosureFindings";

export {
  REQUIRED_STAGE7_C_BUNDLE_CLOSURE_CONFIRMATIONS,
  RUNTIME_CONTRACT_BUNDLE_CLOSURE_TITLE,
  RUNTIME_CONTRACT_BUNDLE_CLOSURE_VERSION,
  STAGE7_C_RECOMMENDED_NEXT_PHASES,
  STAGE7_C_SEPARATED_WORK_ITEMS,
  STAGE8_A_MINIMAL_VERTICAL_SLICE_SCOPE,
  STAGE8_A_OUT_OF_SCOPE,
  STAGE8_ENTRY_CANDIDATE,
} from "@/lib/agents/runtimeContractBundleClosureConstants";

export function evaluateRuntimeContractBundleClosureSource(
  input?: RuntimeContractBundleClosureInput,
): RuntimeApiContractDesignReport {
  return evaluateRuntimeApiContractDesign(input?.apiContractDesign);
}
