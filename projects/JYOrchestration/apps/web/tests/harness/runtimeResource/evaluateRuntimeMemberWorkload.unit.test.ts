import { describe, expect, it } from "vitest";

import { evaluateRuntimeMemberWorkload } from "@/lib/harness/runtimeResource/evaluateRuntimeMemberWorkload";
import { buildResourcePlanningTestFixtures } from "./resourceTestFixtures";

describe("H20.5 evaluateRuntimeMemberWorkload", () => {
  it("evaluates member workload with read-only mode", () => {
    const { semantic } = buildResourcePlanningTestFixtures();
    const workload = evaluateRuntimeMemberWorkload(semantic);
    expect(workload.mode).toBe("runtime_member_workload");
    expect(workload.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(workload.members.length).toBeGreaterThan(0);
  });
});
