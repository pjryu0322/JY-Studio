import { describe, expect, it } from "vitest";

import { legacyProblemInterviewFallbackEnabled } from "@/lib/config/publicFeatureFlags";

describe("publicFeatureFlags", () => {
  it("legacyProblemInterviewFallbackEnabled defaults to false", () => {
    // In vitest, NEXT_PUBLIC_* is usually unset unless explicitly configured.
    expect(legacyProblemInterviewFallbackEnabled()).toBe(false);
  });

  it("legacyProblemInterviewFallbackEnabled honors NEXT_PUBLIC_ or ENABLE_ flags", () => {
    const prevPublic = process.env.NEXT_PUBLIC_ENABLE_LEGACY_PROBLEM_INTERVIEW_FALLBACK;
    const prevPrivate = process.env.ENABLE_LEGACY_PROBLEM_INTERVIEW_FALLBACK;
    try {
      process.env.NEXT_PUBLIC_ENABLE_LEGACY_PROBLEM_INTERVIEW_FALLBACK = "1";
      process.env.ENABLE_LEGACY_PROBLEM_INTERVIEW_FALLBACK = "";
      expect(legacyProblemInterviewFallbackEnabled()).toBe(true);

      process.env.NEXT_PUBLIC_ENABLE_LEGACY_PROBLEM_INTERVIEW_FALLBACK = "";
      process.env.ENABLE_LEGACY_PROBLEM_INTERVIEW_FALLBACK = "1";
      expect(legacyProblemInterviewFallbackEnabled()).toBe(true);
    } finally {
      process.env.NEXT_PUBLIC_ENABLE_LEGACY_PROBLEM_INTERVIEW_FALLBACK = prevPublic;
      process.env.ENABLE_LEGACY_PROBLEM_INTERVIEW_FALLBACK = prevPrivate;
    }
  });
});

