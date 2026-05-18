/**
 * Assemble feature-generation entry decision + discriminated entry result.
 */

import type { RequirementGapDecision, RequirementReadinessResult, RequirementRefinementDecision, RefinedRequirement } from "../requirementInput/refinement/refinementContracts";
import type { FeatureGenerationBlockedReason, FeatureGenerationDecision, FeatureGenerationEntryResult } from "./featureEntryContracts";
import { canGenerateFeatures } from "./canGenerateFeatures";
import { prepareFeatureGenerationInput } from "./prepareFeatureGenerationInput";
import { buildBlockedFeatureGenerationResult } from "./buildBlockedFeatureGenerationResult";
import { mapGapDecisionToBlockedReason } from "./mapGapDecisionToBlockedReason";
import { FEATURE_GENERATION_ENTRY_CODE } from "./featureEntryResultCodes";

export type BuildFeatureGenerationDecisionInput = {
  refinementDecision: RequirementRefinementDecision;
  readinessResult: RequirementReadinessResult;
  refinedRequirements: readonly RefinedRequirement[];
};

function pendingNonAutoDecisions(readiness: RequirementReadinessResult): RequirementGapDecision[] {
  return [...readiness.blockingIssues, ...readiness.confirmRequired];
}

function dedupeReasons(rows: FeatureGenerationBlockedReason[]): FeatureGenerationBlockedReason[] {
  const seen = new Set<string>();
  const out: FeatureGenerationBlockedReason[] = [];
  for (const r of rows) {
    const key = `${r.code}|${r.sourceGapCode ?? ""}|${r.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function buildReasonsForNonReadyEntry(params: {
  refinementDecision: RequirementRefinementDecision;
  readinessResult: RequirementReadinessResult;
  refinedRequirements: readonly RefinedRequirement[];
  projectMismatch: boolean;
}): FeatureGenerationBlockedReason[] {
  const { refinementDecision, readinessResult, refinedRequirements, projectMismatch } = params;
  const reasons: FeatureGenerationBlockedReason[] = [];
  if (!refinementDecision.normalizedText.trim()) {
    reasons.push({
      code: FEATURE_GENERATION_ENTRY_CODE.BLOCKED_VAGUE_INPUT,
      message: "Normalized requirement text is empty; cannot derive features.",
    });
  }
  for (const d of pendingNonAutoDecisions(readinessResult)) {
    if (d.mode === "BLOCKING" || d.mode === "USER_CONFIRM") {
      reasons.push(mapGapDecisionToBlockedReason(d));
    }
  }
  if (refinedRequirements.length === 0) {
    reasons.push({
      code: FEATURE_GENERATION_ENTRY_CODE.BLOCKED_NO_REQUIREMENTS,
      message: "No refined requirement rows are available for feature synthesis.",
    });
  }
  if (projectMismatch) {
    reasons.push({
      code: FEATURE_GENERATION_ENTRY_CODE.BLOCKED_CONFLICT,
      message: "Refined requirements use inconsistent projectId values.",
    });
  }
  return dedupeReasons(reasons);
}

/**
 * Returns the high-level decision record and the entry result used as the gatekeeper handoff.
 */
export function buildFeatureGenerationDecision(
  input: BuildFeatureGenerationDecisionInput
): { decision: FeatureGenerationDecision; entry: FeatureGenerationEntryResult } {
  const { refinementDecision, readinessResult, refinedRequirements } = input;

  const readinessStatus = canGenerateFeatures(readinessResult, refinementDecision);

  let projectMismatch = false;
  const bundle =
    readinessStatus === "READY" && refinedRequirements.length > 0
      ? prepareFeatureGenerationInput(refinedRequirements)
      : null;

  if (readinessStatus === "READY" && refinedRequirements.length > 0 && bundle == null) {
    projectMismatch = true;
  }

  if (readinessStatus === "READY" && bundle != null) {
    const decision: FeatureGenerationDecision = { status: "READY", reasons: [] };
    const entry: FeatureGenerationEntryResult = { ok: true, status: "READY", input: bundle };
    return { decision, entry };
  }

  const finalStatus: "NEEDS_CONFIRMATION" | "BLOCKED" =
    readinessStatus === "NEEDS_CONFIRMATION" ? "NEEDS_CONFIRMATION" : "BLOCKED";

  const reasons = buildReasonsForNonReadyEntry({
    refinementDecision,
    readinessResult,
    refinedRequirements,
    projectMismatch,
  });

  const decision: FeatureGenerationDecision = { status: finalStatus, reasons };
  const entry = buildBlockedFeatureGenerationResult({
    status: finalStatus,
    reasons: decision.reasons,
    pendingGapDecisions: pendingNonAutoDecisions(readinessResult),
  });
  return { decision, entry };
}
