/** Public (NEXT_PUBLIC_*) feature flags for client bundles. */

export function legacyProblemInterviewFallbackEnabled(): boolean {
  // Default: disabled. Enable only for local debug / emergency regression checks.
  const publicFlag = String(process.env.NEXT_PUBLIC_ENABLE_LEGACY_PROBLEM_INTERVIEW_FALLBACK ?? "").trim();
  const privateFlag = String(process.env.ENABLE_LEGACY_PROBLEM_INTERVIEW_FALLBACK ?? "").trim();
  return publicFlag === "1" || privateFlag === "1";
}

