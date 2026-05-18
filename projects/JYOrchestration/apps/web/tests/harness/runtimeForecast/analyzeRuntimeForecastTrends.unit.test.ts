import { describe, expect, it } from "vitest";

import { analyzeRuntimeForecastTrends } from "@/lib/harness/runtimeForecast/analyzeRuntimeForecastTrends";
import { buildForecastPlanningTestFixtures } from "./forecastTestFixtures";

describe("H20 analyzeRuntimeForecastTrends", () => {
  it("returns five capped trend dimensions", () => {
    const { semantic } = buildForecastPlanningTestFixtures();
    const trends = analyzeRuntimeForecastTrends(semantic);
    expect(trends.length).toBe(5);
    expect(new Set(trends.map((t) => t.kind)).size).toBe(5);
    expect(trends.every((t) => t.labelKo.length > 0)).toBe(true);
  });
});
