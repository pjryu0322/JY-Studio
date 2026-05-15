import { describe, expect, it } from "vitest";

import { buildRuntimeResourcePlanningReports } from "@/lib/harness/runtimeResource/buildRuntimeResourcePlanningReports";
import { forecastRuntimeResourceCapacity } from "@/lib/harness/runtimeResource/forecastRuntimeResourceCapacity";
import { buildResourcePlanningTestFixtures } from "./resourceTestFixtures";

describe("H20.5 forecastRuntimeResourceCapacity", () => {
  it("forecasts capacity with read-only mode", () => {
    const { semantic } = buildResourcePlanningTestFixtures();
    const capacity = forecastRuntimeResourceCapacity(semantic);
    expect(capacity.mode).toBe("runtime_resource_capacity");
    expect(capacity.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(["comfortable", "tight", "strained", "exhaustion_candidate"]).toContain(capacity.outlook);
  });

  it("builds full resource planning reports once", () => {
    const { semantic } = buildResourcePlanningTestFixtures();
    const reports = buildRuntimeResourcePlanningReports(semantic);
    expect(reports.runtimeResourceSummary.mode).toBe("runtime_resource_summary");
    expect(reports.runtimeResourceExplainability.mode).toBe("runtime_resource_explainability");
  });
});
