import { describe, expect, it } from "vitest";

import { analyzeRuntimeResourcePressure } from "@/lib/harness/runtimeResource/analyzeRuntimeResourcePressure";
import { buildResourcePlanningTestFixtures } from "./resourceTestFixtures";

describe("H20.5 analyzeRuntimeResourcePressure", () => {
  it("returns six capped pressure dimensions", () => {
    const { semantic } = buildResourcePlanningTestFixtures();
    const pressures = analyzeRuntimeResourcePressure(semantic);
    expect(pressures.length).toBe(6);
    expect(new Set(pressures.map((p) => p.kind)).size).toBe(6);
  });
});
