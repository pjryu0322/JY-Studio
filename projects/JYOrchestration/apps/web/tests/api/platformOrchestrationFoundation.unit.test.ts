import { describe, expect, it } from "vitest";
import { PLATFORM_FLOW_IDS, isPlatformFlowId } from "@/lib/platform-orchestration/flowIds";
import {
  PLATFORM_CORE_MEMBER_ROLES,
  PLATFORM_ROLE_DEFINITIONS,
  getPlatformRoleDefinition,
} from "@/lib/platform-orchestration/roles";
import {
  createPlatformRunResult,
  createPlatformTrigger,
} from "@/lib/platform-orchestration/runResultFactory";

describe("platformOrchestrationFoundation", () => {
  it("registers all platform flow ids", () => {
    expect(PLATFORM_FLOW_IDS).toContain("fast_plan_draft");
    expect(PLATFORM_FLOW_IDS).toContain("execution_runtime");
    expect(isPlatformFlowId("fast_plan_draft")).toBe(true);
    expect(isPlatformFlowId("not_a_flow")).toBe(false);
  });

  it("defines core roles with defaultEnabled true", () => {
    for (const role of PLATFORM_CORE_MEMBER_ROLES) {
      const def = getPlatformRoleDefinition(role);
      expect(def?.defaultEnabled).toBe(true);
    }
    expect(PLATFORM_ROLE_DEFINITIONS.length).toBeGreaterThanOrEqual(8);
  });

  it("creates a platform run result with default empty arrays", () => {
    const trigger = createPlatformTrigger({
      flowId: "fast_plan_draft",
      source: "cta",
      projectId: "p1",
      conversationScope: "project_workspace",
    });

    const result = createPlatformRunResult({
      flowId: "fast_plan_draft",
      trigger,
    });

    expect(result.flowId).toBe("fast_plan_draft");
    expect(result.trigger.triggerId).toBeTruthy();
    expect(result.memberRuns).toEqual([]);
    expect(result.memberDrafts).toEqual([]);
    expect(result.statePatches).toEqual([]);
    expect(result.timelineEvents).toEqual([]);
    expect(result.nextActions).toEqual([]);
  });
});
