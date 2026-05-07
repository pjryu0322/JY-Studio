import { describe, expect, it } from "vitest";

import { legacyProblemInterviewFallbackEnabled } from "@/lib/config/publicFeatureFlags";

describe("publicFeatureFlags", () => {
  it("legacyProblemInterviewFallbackEnabled defaults to false", () => {
    // In vitest, NEXT_PUBLIC_* is usually unset unless explicitly configured.
    expect(legacyProblemInterviewFallbackEnabled()).toBe(false);
  });
});

