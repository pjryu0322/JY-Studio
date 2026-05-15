import { describe, expect, it } from "vitest";

import { buildRuntimeForecastPlanningReports } from "@/lib/harness/runtimeForecast/buildRuntimeForecastPlanningReports";
import { evaluateRuntimeForecastStability } from "@/lib/harness/runtimeForecast/evaluateRuntimeForecastStability";
import { buildForecastPlanningTestFixtures } from "./forecastTestFixtures";

describe("H20 evaluateRuntimeForecastStability", () => {
  it("evaluates longitudinal stability outlook", () => {
    const { semantic } = buildForecastPlanningTestFixtures();
    const stability = evaluateRuntimeForecastStability(semantic);
    expect(stability.mode).toBe("runtime_forecast_stability");
    expect(stability.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(["stable", "watch", "degrading", "critical_candidate"]).toContain(stability.outlook);
  });

  it("builds full forecast planning reports once", () => {
    const { semantic } = buildForecastPlanningTestFixtures();
    const reports = buildRuntimeForecastPlanningReports(semantic);
    expect(reports.runtimeForecastSummary.mode).toBe("runtime_forecast_summary");
    expect(reports.runtimeForecastGovernanceDrift.mode).toBe("runtime_forecast_governance_drift");
  });
});
