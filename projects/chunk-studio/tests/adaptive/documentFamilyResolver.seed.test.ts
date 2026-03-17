import { describe, expect, it } from "vitest";
import { resolveDocumentFamily } from "../../src/lib/chunking/adaptive/documentFamilyResolver";
import { loadDocumentFamilySeeds, toDocumentFamilyInput } from "./fixtures";

describe("documentFamilyResolver seed validation", () => {
  const seeds = loadDocumentFamilySeeds();

  it("returns expected family with valid confidence and reasoning", () => {
    for (const seed of seeds) {
      const result = resolveDocumentFamily(toDocumentFamilyInput(seed));
      expect(result.documentFamilyId).toBeTruthy();
      expect(result.documentFamilyId).toBe(seed.documentFamilyId);
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThanOrEqual(0.95);
      expect(Array.isArray(result.reasoning)).toBe(true);
      expect(result.reasoning.length).toBeGreaterThan(0);
    }
  });
});
