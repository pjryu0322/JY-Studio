/**
 * Stage 8-A runtime execution vertical slice support (read-only).
 */

export { buildRuntimeExecutionVerticalSliceChecklists } from "@/lib/agents/runtimeExecutionVerticalSliceChecklists";
export { appendRuntimeExecutionVerticalSliceFindings } from "@/lib/agents/runtimeExecutionVerticalSliceFindings";
export {
  parseRuntimeExecutionVerticalSliceInput,
  resolveRuntimeExecutionVerticalSliceDecision,
} from "@/lib/agents/runtimeExecutionVerticalSliceDecision";
export type { ParsedRuntimeExecutionVerticalSliceInput } from "@/lib/agents/runtimeExecutionVerticalSliceDecision";
export {
  buildRuntimeExecutionVerticalSliceFingerprint,
  buildRuntimeExecutionVerticalSliceSummary,
} from "@/lib/agents/runtimeExecutionVerticalSliceFingerprint";
export {
  normalizeRuntimeExecutionRequest,
  validateRuntimeExecutionRequest,
} from "@/lib/agents/runtimeExecutionVerticalSliceRequestValidation";
export { executeRuntimeExecutionVerticalSliceChain } from "@/lib/agents/runtimeExecutionVerticalSliceChain";

export {
  REQUIRED_STAGE8_A_CONFIRMATIONS,
  RUNTIME_EXECUTION_VERTICAL_SLICE_TITLE,
  RUNTIME_EXECUTION_VERTICAL_SLICE_VERSION,
  STAGE8_A_RECOMMENDED_NEXT_PHASES,
  STAGE8_A_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionVerticalSliceConstants";

export {
  createInitialRuntimeExecutionStore,
  createRuntimeExecutionRecord,
  appendRuntimeExecutionRecord,
  transitionRuntimeExecutionRecord,
} from "@/lib/agents/runtimeExecutionVerticalSliceStore";

export { runMockRuntimeExecution } from "@/lib/agents/runtimeExecutionVerticalSliceRunner";
