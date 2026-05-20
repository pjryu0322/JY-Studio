import { describe, expect, it, vi } from "vitest";
import * as connectorFacade from "@/lib/agents/connectorGatewayFacade";
import * as capabilityRegistry from "@/lib/agents/capabilityRegistry";
import {
  buildGovernancePrecheckForCapability,
  planAgentHarnessDryRun,
  planRequirementsHarnessDryRun,
} from "@/lib/agents/agentHarnessDryRun";
import * as requirementsDispatch from "@/lib/requirements/requirementsIntentDispatch";

describe("multi-agent harness dry-run stage 2-3", () => {
  it("ideation intent resolves ai-planner with planned status", () => {
    const r = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    expect(r.agentId).toBe("ai-planner");
    expect(r.capabilityId).toBe("project.idea.structure");
    expect(r.status).toBe("planned");
    expect(r.executable).toBe(true);
  });

  it("prototype_build intent resolves ai-developer with cursor capability", () => {
    const r = planAgentHarnessDryRun({ intent: "prototype_build" });
    expect(r.agentId).toBe("ai-developer");
    expect(r.capabilityId).toBe("cursor.implementation.plan");
    expect(["planned", "warning"]).toContain(r.status);
    expect(r.requiredConnectors).toContain("cursor");
    expect(r.connectorPlans.some((p) => p.connectorId === "cursor" && p.allowed)).toBe(true);
  });

  it("security_review intent resolves ai-security with security capability", () => {
    const r = planAgentHarnessDryRun({ intent: "security_review" });
    expect(r.agentId).toBe("ai-security");
    expect(r.capabilityId).toBe("security.review");
    expect(r.status).toBe("planned");
    expect(r.executable).toBe(true);
  });

  it("unknown intent does not throw and returns no_agent or blocking", () => {
    expect(() =>
      planAgentHarnessDryRun({ intent: "totally_unknown_intent_xyz", stage: "UNKNOWN_STAGE_XYZ" }),
    ).not.toThrow();
    const r = planAgentHarnessDryRun({
      intent: "totally_unknown_intent_xyz",
      stage: "UNKNOWN_STAGE_XYZ",
    });
    expect(r.executable).toBe(false);
    expect(["no_agent", "blocked", "no_capability"]).toContain(r.status);
  });

  it("explicit agentId takes precedence over resolver", () => {
    const r = planAgentHarnessDryRun({
      intent: "ideation",
      agentId: "ai-scm",
      capabilityId: "git.pr.merge.control",
    });
    expect(r.agentId).toBe("ai-scm");
    expect(r.capabilityId).toBe("git.pr.merge.control");
  });

  it("explicit capabilityId is used with binding validation", () => {
    const r = planAgentHarnessDryRun({
      agentId: "ai-developer",
      capabilityId: "cursor.implementation.plan",
    });
    expect(r.capabilityId).toBe("cursor.implementation.plan");
    expect(r.executable).toBe(true);
  });

  it("invalid agent-capability binding returns blocked", () => {
    const r = planAgentHarnessDryRun({
      agentId: "ai-planner",
      capabilityId: "cursor.implementation.plan",
    });
    expect(r.executable).toBe(false);
    expect(r.status).toBe("blocked");
    expect(r.blockingReasons.some((b) => b.includes("binding"))).toBe(true);
  });

  it("capability with requiredConnectors produces connectorPlans", () => {
    const r = planAgentHarnessDryRun({
      agentId: "ai-developer",
      capabilityId: "cursor.implementation.plan",
    });
    expect(r.connectorPlans.length).toBeGreaterThan(0);
    expect(r.connectorPlans[0]?.mode).toBe("dry_run");
  });

  it("disabled required connector blocks harness", () => {
    vi.spyOn(capabilityRegistry, "getCapabilityById").mockImplementation((id: string) => {
      if (id === "test.requires.codex") {
        return {
          id,
          name: "Test Codex",
          category: "development",
          description: "test",
          requiredConnectors: ["codex"],
          enabled: true,
        };
      }
      return capabilityRegistry.getCapabilityById(id);
    });

    const r = planAgentHarnessDryRun({
      agentId: "ai-developer",
      capabilityId: "test.requires.codex",
    });
    expect(r.executable).toBe(false);
    expect(r.status).toBe("blocked");
    vi.restoreAllMocks();
  });

  it("governanceChecks appear in governancePrecheck.requiredChecks", () => {
    const pre = buildGovernancePrecheckForCapability("project.idea.structure");
    expect(pre.requiredChecks).toContain("stage:ideation");
    expect(pre.status).toBe("pass_candidate");

    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    expect(harness.governancePrecheck.requiredChecks.length).toBeGreaterThan(0);
  });

  it("planRequirementsHarnessDryRun does not call requirements dispatch", () => {
    const dispatchSpy = vi.spyOn(requirementsDispatch, "dispatchRequirementsUserIntent");
    const r = planRequirementsHarnessDryRun({
      intent: "ideation",
      stage: "IDEATION",
      projectId: "p1",
    });
    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(r.metadata?.source).toBe("requirements");
    dispatchSpy.mockRestore();
  });

  it("dry-run uses connector facade only without external invocation", () => {
    const planSpy = vi.spyOn(connectorFacade, "planConnectorInvocation");
    planAgentHarnessDryRun({
      agentId: "ai-developer",
      capabilityId: "cursor.implementation.plan",
    });
    expect(planSpy).toHaveBeenCalled();
    for (const call of planSpy.mock.calls) {
      expect(call[0]?.mode).toBe("dry_run");
    }
    planSpy.mockRestore();
  });
});
