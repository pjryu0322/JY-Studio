import { afterEach, describe, expect, it, vi } from "vitest";
import * as connectorFacade from "@/lib/agents/connectorGatewayFacade";
import * as capabilityRegistry from "@/lib/agents/capabilityRegistry";
import * as governancePrecheckModule from "@/lib/agents/governancePrecheckDryRun";
import {
  buildGovernancePrecheckForCapability,
  planAgentHarnessDryRun,
  planRequirementsHarnessDryRun,
} from "@/lib/agents/agentHarnessDryRun";
import * as requirementsDispatch from "@/lib/requirements/requirementsIntentDispatch";

const originalGetCapabilityById = capabilityRegistry.getCapabilityById;

describe("multi-agent harness dry-run stage 2-3", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ideation intent resolves ai-planner with planned status", () => {
    const r = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION", source: "manual" });
    expect(r.agentId).toBe("ai-planner");
    expect(r.capabilityId).toBe("project.idea.structure");
    expect(r.status).toBe("planned");
    expect(r.executable).toBe(true);
    expect(r.metadata?.source).toBe("manual");
    expect(r.governanceDryRun?.status).toBe("pass_candidate");
  });

  it("prototype_build intent resolves ai-developer with cursor capability", () => {
    const r = planAgentHarnessDryRun({ intent: "prototype_build" });
    expect(r.agentId).toBe("ai-developer");
    expect(r.capabilityId).toBe("cursor.implementation.plan");
    expect(r.status).toBe("warning");
    expect(r.reason).toContain("governance_warning_candidate");
    expect(r.executable).toBe(true);
    expect(r.requiredConnectors).toContain("cursor");
    expect(r.connectorPlans.some((p) => p.connectorId === "cursor" && p.allowed)).toBe(true);
    expect(r.governanceDryRun?.requiredChecks).toContain("connector:cursor");
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
      source: "requirements",
    });
    expect(r.executable).toBe(false);
    expect(["no_agent", "blocked", "no_capability"]).toContain(r.status);
    expect(r.metadata?.source).toBe("requirements");
  });

  it("explicit agentId takes precedence over resolver", () => {
    const r = planAgentHarnessDryRun({
      intent: "ideation",
      agentId: "ai-scm",
      capabilityId: "git.pr.merge.control",
    });
    expect(r.agentId).toBe("ai-scm");
    expect(r.capabilityId).toBe("git.pr.merge.control");
    expect(r.metadata?.agentResolutionReason).toBe("direct:ai-scm");
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
      source: "manual",
    });
    expect(r.executable).toBe(false);
    expect(r.status).toBe("blocked");
    expect(r.metadata?.source).toBe("manual");
    expect(r.blockingReasons.some((b) => b.includes("binding"))).toBe(true);
  });

  it("capability with requiredConnectors produces connectorPlans", () => {
    const r = planAgentHarnessDryRun({
      agentId: "ai-developer",
      capabilityId: "cursor.implementation.plan",
    });
    expect(r.connectorPlans.length).toBeGreaterThan(0);
    expect(r.connectorPlans[0]?.mode).toBe("dry_run");
    expect(r.metadata?.connectorPlanSummary).toContain("cursor");
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
          allowedAgentTypes: ["developer"],
          enabled: true,
        };
      }
      return originalGetCapabilityById(id);
    });

    const r = planAgentHarnessDryRun({
      agentId: "ai-developer",
      capabilityId: "test.requires.codex",
    });
    expect(r.executable).toBe(false);
    expect(r.status).toBe("blocked");
  });

  it("unknown capability with blockingReasons yields governancePrecheck blocked", () => {
    const pre = buildGovernancePrecheckForCapability("unknown.capability", {
      blockingReasons: ["binding_invalid"],
      warnings: ["unknown_capability:unknown.capability"],
    });
    expect(pre.status).toBe("blocked");
  });

  it("governanceChecks appear in governancePrecheck and governanceDryRun", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    expect(harness.governancePrecheck.requiredChecks).toContain("stage:ideation");
    expect(harness.governanceDryRun?.status).toBe("pass_candidate");
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
    expect(r.metadata?.projectId).toBe("p1");
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
  });

  it("governance warning_candidate elevates harness status to warning", () => {
    const r = planAgentHarnessDryRun({
      agentId: "ai-developer",
      capabilityId: "cursor.implementation.plan",
    });
    expect(r.governanceDryRun?.status).toBe("warning_candidate");
    expect(r.status).toBe("warning");
    expect(r.executable).toBe(true);
    expect(r.governanceDryRunSummary?.evaluatedPolicyCount).toBeGreaterThan(0);
  });

  it("governance blocking_candidate does not force executable false", () => {
    vi.spyOn(governancePrecheckModule, "evaluateGovernancePrecheckDryRun").mockReturnValue({
      mode: "dry_run",
      status: "blocking_candidate",
      requiredChecks: ["registry-guard"],
      evaluatedPolicyIds: ["registry.guard.required"],
      findings: [
        {
          policyId: "registry.guard.required",
          check: "registry-guard",
          severity: "blocking_candidate",
          message: "policy_matched:registry.guard.required",
        },
      ],
      warnings: [],
      blockingCandidates: ["registry.guard.required"],
    });

    const r = planAgentHarnessDryRun({
      agentId: "ai-planner",
      capabilityId: "orchestration.intent.route",
    });
    expect(r.executable).toBe(true);
    expect(r.status).toBe("warning");
    expect(r.governanceDryRun?.status).toBe("blocking_candidate");
    expect(r.reason).toContain("governance_blocking_candidate");
    expect(r.warnings.some((w) => w.includes("governance_blocking_candidate"))).toBe(true);
  });

  it("no_agent result keeps metadata.source", () => {
    const r = planAgentHarnessDryRun({
      intent: "unknown_xyz",
      stage: "UNKNOWN",
      source: "requirements",
    });
    expect(r.metadata?.source).toBe("requirements");
  });
});
