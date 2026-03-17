import { describe, expect, it } from "vitest";
import { resolveChunkStrategy } from "../../src/lib/chunking/adaptive/strategyResolver";
import { loadDocumentFamilySeeds, toStrategyInput } from "./fixtures";

describe("strategyResolver seed validation", () => {
  const seeds = loadDocumentFamilySeeds();

  it("returns expected strategy with config and reasoning", () => {
    for (const seed of seeds) {
      const result = resolveChunkStrategy(toStrategyInput(seed));
      expect(result.strategyId).toBeTruthy();
      expect(result.strategyId).toBe(seed.expectedStrategyId);
      expect(result.config).toBeDefined();
      expect(typeof result.config).toBe("object");
      expect(Array.isArray(result.reasoning)).toBe(true);
      expect(result.reasoning.length).toBeGreaterThan(0);
    }
  });
});
