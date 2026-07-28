/**
 * P4 — map quality outcomes to Generation completion states (workflow-facing).
 * Does not invent a second SoT; workflows still use AdminQualityGateSnapshot + zip phase.
 */
export type GenerationOutcomeStatus =
  | "READY"
  | "RUNNING"
  | "SUCCEEDED"
  | "SUCCEEDED_WITH_WARNINGS"
  | "CORRECTION_REQUIRED"
  | "FAILED";

export function resolveGenerationOutcome(input: {
  workerZipPhase: "NONE" | "REQUESTED" | "ACCEPTED" | "REJECTED" | "PROCESSING" | "COMPLETED" | "FAILED";
  qualityCompleted: boolean;
  hasBlockers: boolean;
  failCount: number;
  hasWarnings: boolean;
}): GenerationOutcomeStatus {
  if (input.workerZipPhase === "FAILED") return "FAILED";
  if (input.workerZipPhase === "PROCESSING") return "RUNNING";
  if (input.workerZipPhase !== "COMPLETED") return "READY";
  if (!input.qualityCompleted) return "RUNNING";
  if (input.hasBlockers || input.failCount > 0) return "CORRECTION_REQUIRED";
  if (input.hasWarnings) return "SUCCEEDED_WITH_WARNINGS";
  return "SUCCEEDED";
}

export function generationOutcomeAllowsServiceValidation(
  outcome: GenerationOutcomeStatus,
): boolean {
  return outcome === "SUCCEEDED" || outcome === "SUCCEEDED_WITH_WARNINGS";
}

export function generationOutcomeRequiresCorrection(
  outcome: GenerationOutcomeStatus,
): boolean {
  return outcome === "CORRECTION_REQUIRED";
}
