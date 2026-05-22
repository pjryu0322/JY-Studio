/**
 * Stage 7-B runtime API contract design support (read-only).
 */

import { evaluateRuntimeImplementationPlanningCandidate } from "@/lib/agents/evaluateRuntimeImplementationPlanningCandidate";
import { buildRuntimeApiContractDesignChecklists } from "@/lib/agents/runtimeApiContractDesignChecklists";
import {
  parseRuntimeApiContractDesignInput,
  resolveRuntimeApiContractDesignDecision,
} from "@/lib/agents/runtimeApiContractDesignDecision";
import {
  buildRuntimeApiEndpointContracts,
  computeRuntimeApiContractTrace,
} from "@/lib/agents/runtimeApiContractDesignEndpoints";
import { validateRuntimeApiEndpointContracts } from "@/lib/agents/runtimeApiContractDesignEndpointValidation";
import {
  buildRuntimeApiContractDesignFingerprint,
  buildRuntimeApiContractDesignSummary,
} from "@/lib/agents/runtimeApiContractDesignFingerprint";
import { appendRuntimeApiContractDesignFindings } from "@/lib/agents/runtimeApiContractDesignFindings";
import type { RuntimeImplementationPlanningCandidateReport } from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";
import type { RuntimeApiContractDesignInput } from "@/lib/agents/runtimeApiContractDesignTypes";

export { buildRuntimeApiEndpointContracts, computeRuntimeApiContractTrace } from "@/lib/agents/runtimeApiContractDesignEndpoints";
export { validateRuntimeApiEndpointContracts } from "@/lib/agents/runtimeApiContractDesignEndpointValidation";
export {
  parseRuntimeApiContractDesignInput,
  resolveRuntimeApiContractDesignDecision,
} from "@/lib/agents/runtimeApiContractDesignDecision";
export {
  buildRuntimeApiContractDesignFingerprint,
  buildRuntimeApiContractDesignSummary,
} from "@/lib/agents/runtimeApiContractDesignFingerprint";

export { buildRuntimeApiContractDesignChecklists } from "@/lib/agents/runtimeApiContractDesignChecklists";
export { appendRuntimeApiContractDesignFindings } from "@/lib/agents/runtimeApiContractDesignFindings";

export {
  REQUIRED_STAGE7_B_RUNTIME_API_CONFIRMATIONS,
  RUNTIME_API_CONTRACT_DESIGN_TITLE,
  RUNTIME_API_CONTRACT_DESIGN_VERSION,
  STAGE7_B_RECOMMENDED_NEXT_PHASES,
  STAGE7_B_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeApiContractDesignConstants";

/** Evaluate source Stage 7-A report for API contract design. */
export function evaluateRuntimeApiContractDesignSource(
  input?: RuntimeApiContractDesignInput,
): RuntimeImplementationPlanningCandidateReport {
  return evaluateRuntimeImplementationPlanningCandidate(input?.implementationPlanning);
}
