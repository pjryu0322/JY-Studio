/**
 * PackWorkflowFacts invariants — enforced after loader/assemble normalize.
 * mode:
 * - auto: throw in development/test, warn in production
 * - strict: always throw
 * - warn: always warn
 */
import type { PackWorkflowFacts } from "@/lib/workflow/pack-workflow-facts";

export type PackWorkflowInvariantViolation = {
  code: string;
  message: string;
};

export function collectPackWorkflowInvariantViolations(
  facts: PackWorkflowFacts,
): PackWorkflowInvariantViolation[] {
  const violations: PackWorkflowInvariantViolation[] = [];

  if (facts.providerReview.confirmed || facts.providerReview.phase === "CONFIRMED") {
    if (!facts.providerReview.generationId) {
      violations.push({
        code: "PROVIDER_CONFIRMED_WITHOUT_GENERATION",
        message: "providerReview.confirmed requires providerReview.generationId",
      });
    }
  }

  if (facts.serviceValidation.phase === "PASSED") {
    if (!facts.serviceValidation.generationId) {
      violations.push({
        code: "SERVICE_PASSED_WITHOUT_GENERATION",
        message: "serviceValidation.PASSED requires serviceValidation.generationId",
      });
    }
  }

  if (facts.publishing.recoveryMode === "RESTORE_EXISTING") {
    if (!facts.publishing.preservedGenerationId) {
      violations.push({
        code: "RESTORE_WITHOUT_PRESERVED_GENERATION",
        message: "RESTORE_EXISTING requires publishing.preservedGenerationId",
      });
    }
  }

  if (facts.publishing.recoveryMode === "PUBLISH_NEW_REVISION") {
    if (!facts.generation.generationId && !facts.serviceValidation.generationId) {
      violations.push({
        code: "NEW_REVISION_WITHOUT_DRAFT_GENERATION",
        message: "PUBLISH_NEW_REVISION requires a draft generationId",
      });
    }
  }

  return violations;
}

function isStrictAutoEnv(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  return nodeEnv === "development" || nodeEnv === "test";
}

export function enforcePackWorkflowFactsInvariants(
  facts: PackWorkflowFacts,
  options?: { mode?: "auto" | "strict" | "warn" },
): void {
  const violations = collectPackWorkflowInvariantViolations(facts);
  if (violations.length === 0) return;

  const detail = violations.map((v) => `${v.code}: ${v.message}`).join("; ");
  const mode = options?.mode ?? "auto";
  const shouldThrow =
    mode === "strict" || (mode === "auto" && isStrictAutoEnv());

  if (shouldThrow) {
    throw new Error(`PackWorkflowFacts invariant violated: ${detail}`);
  }

  console.warn(`[PackWorkflowFacts] invariant warning: ${detail}`, {
    packId: facts.packId,
    codes: violations.map((v) => v.code),
  });
}
