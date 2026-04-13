/**
 * Decide whether Feature generation may proceed automatically (no blocking / no pending confirms).
 */

import type { RequirementReadinessResult, RequirementRefinementDecision } from "./refinementContracts";

/**
 * Ready only when there are no `BLOCKING` and no `USER_CONFIRM` decisions (AUTO-only or empty).
 */
export function evaluateRequirementReadiness(decision: RequirementRefinementDecision): RequirementReadinessResult {
  const blockingIssues = decision.decisions.filter((d) => d.mode === "BLOCKING");
  const confirmRequired = decision.decisions.filter((d) => d.mode === "USER_CONFIRM");
  const autoResolved = decision.decisions.filter((d) => d.mode === "AUTO");
  const isReady = blockingIssues.length === 0 && confirmRequired.length === 0;
  return { isReady, blockingIssues, confirmRequired, autoResolved };
}
