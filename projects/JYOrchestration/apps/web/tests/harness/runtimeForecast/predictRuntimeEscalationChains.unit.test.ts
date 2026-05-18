import { describe, expect, it } from "vitest";

import { predictRuntimeEscalationChains } from "@/lib/harness/runtimeForecast/predictRuntimeEscalationChains";
import { buildForecastPlanningTestFixtures } from "./forecastTestFixtures";

describe("H20 predictRuntimeEscalationChains", () => {
  it("dedupes escalation chains with read-only mode", () => {
    const { semantic } = buildForecastPlanningTestFixtures();
    const escalation = predictRuntimeEscalationChains(semantic);
    expect(escalation.mode).toBe("runtime_forecast_escalation");
    expect(escalation.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(escalation.chains.length).toBeGreaterThan(0);
    expect(escalation.chains.length).toBeLessThanOrEqual(5);
    expect(new Set(escalation.chains.map((c) => c.toLowerCase())).size).toBe(escalation.chains.length);
  });
});
