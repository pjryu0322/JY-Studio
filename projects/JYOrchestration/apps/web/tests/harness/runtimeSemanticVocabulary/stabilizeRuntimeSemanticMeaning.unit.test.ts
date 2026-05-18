import { describe, expect, it } from "vitest";

import {
  normalizeSemanticPhrase,
  stabilizeRuntimeSemanticMeaning,
} from "@/lib/harness/runtimeSemanticVocabulary/stabilizeRuntimeSemanticMeaning";

describe("H19 stabilizeRuntimeSemanticMeaning", () => {
  it("maps alias labels to the same canonical key", () => {
    const a = stabilizeRuntimeSemanticMeaning("hidden governance trace");
    const b = stabilizeRuntimeSemanticMeaning("governance trace hidden");
    expect(a.canonicalKey).toBe(b.canonicalKey);
    expect(a.canonicalKey).toBe("governance_hidden_trace");
  });

  it("normalizes propagation escalation aliases in phrases", () => {
    const text = normalizeSemanticPhrase("critical propagation and high escalation detected");
    expect(text).toContain("Propagation escalation");
    expect(text).not.toContain("critical propagation");
  });
});
