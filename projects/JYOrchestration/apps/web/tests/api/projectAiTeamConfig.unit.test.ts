import { describe, expect, it } from "vitest";
import {
  evaluateFlowRoleReadiness,
  getEnabledMembersByRole,
  hasRole,
} from "@/lib/platform-orchestration/projectAiTeam";

describe("projectAiTeamConfig", () => {
  it("blocks prototype_generation when developer role is missing", () => {
    const readiness = evaluateFlowRoleReadiness({
      flowId: "prototype_generation",
      team: {
        projectId: "p1",
        enabledRoles: ["planner", "analyst", "architect", "designer"],
        members: [],
      },
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.missingRequiredRoles).toContain("developer");
  });

  it("requires developer for execution_runtime", () => {
    const readiness = evaluateFlowRoleReadiness({
      flowId: "execution_runtime",
      team: {
        projectId: "p1",
        enabledRoles: ["reviewer", "security", "scm"],
        members: [],
      },
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.missingRequiredRoles).toContain("developer");
  });

  it("is ready for fast_plan_draft when planner is enabled", () => {
    const readiness = evaluateFlowRoleReadiness({
      flowId: "fast_plan_draft",
      team: {
        projectId: "p1",
        enabledRoles: ["planner"],
        members: [],
      },
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.missingRequiredRoles).toEqual([]);
  });

  it("hasRole returns false when role is disabled on all members", () => {
    const config = {
      projectId: "p1",
      enabledRoles: ["developer"] as const,
      members: [
        { memberId: "dev-1", role: "developer" as const, enabled: false },
      ],
    };

    expect(hasRole(config, "developer")).toBe(false);
    expect(getEnabledMembersByRole(config, "developer")).toEqual([]);
  });
});
