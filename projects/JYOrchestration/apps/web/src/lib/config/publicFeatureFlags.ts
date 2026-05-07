/** Public (NEXT_PUBLIC_*) feature flags for client bundles. */

export function legacyProblemInterviewFallbackEnabled(): boolean {
  // Default: disabled. Enable only for local debug / emergency regression checks.
  return String(process.env.NEXT_PUBLIC_ENABLE_LEGACY_PROBLEM_INTERVIEW_FALLBACK ?? "").trim() === "1";
}

