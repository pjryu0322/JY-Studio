import { describe, expect, it } from "vitest";

import { buildExecutionRoutingPlan } from "@/lib/harness/executionRouting/buildExecutionRoutingPlan";
import { summarizeExecutionRoutingPlan } from "@/lib/harness/executionRouting/executionCapabilityTypes";

describe("buildExecutionRoutingPlan", () => {
  it("returns dry_run mode and trimmed role/stage", () => {
    const plan = buildExecutionRoutingPlan({
      roleKey: "  planner ",
      workspaceStage: "prototype-build",
    });
    expect(plan.mode).toBe("dry_run");
    expect(plan.roleKey).toBe("planner");
    expect(plan.workspaceStage).toBe("prototype-build");
  });

  it("generates items for planner role with openai recommendation", () => {
    const plan = buildExecutionRoutingPlan({ roleKey: "planner" });
    expect(plan.items.length).toBe(2);
    const caps = plan.items.map((i) => i.capability);
    expect(caps).toEqual(["analysis", "planning"]);
    for (const item of plan.items) {
      expect(item.provider).toBe("openai");
      expect(item.enabled).toBe(true);
      expect(item.reason).toContain("role_policy_recommended");
      expect(item.warning).toBeUndefined();
    }
  });

  it("matches provider hint when capability is supported", () => {
    const plan = buildExecutionRoutingPlan({
      roleKey: "developer",
      providerHints: ["cursor"],
    });
    expect(plan.items.length).toBe(2);
    for (const item of plan.items) {
      expect(item.provider).toBe("cursor");
      expect(item.enabled).toBe(true);
      expect(item.reason).toBe("provider_hint_matched:cursor");
    }
  });

  it("honors user hint as unsupported when no hint supports the capability", () => {
    const plan = buildExecutionRoutingPlan({
      roleKey: "planner",
      providerHints: ["cursor"],
    });
    for (const item of plan.items) {
      expect(item.provider).toBe("cursor");
      expect(item.enabled).toBe(false);
      expect(item.reason).toBe("provider_hint_unsupported:cursor");
      expect(item.warning).toBeTruthy();
    }
  });

  it("emits info finding when role has no policy match", () => {
    const plan = buildExecutionRoutingPlan({ roleKey: "no-such-role" });
    expect(plan.items.length).toBe(0);
    expect(plan.findings.length).toBeGreaterThan(0);
    const codes = plan.findings.map((f) => f.code);
    expect(codes).toContain("NO_ROLE_POLICY_MATCH");
  });

  it("emits NO_PROVIDER_HINTS info when items exist but hints empty", () => {
    const plan = buildExecutionRoutingPlan({ roleKey: "architect" });
    const codes = plan.findings.map((f) => f.code);
    expect(codes).toContain("NO_PROVIDER_HINTS");
  });

  it("is deterministic given same inputs", () => {
    const a = buildExecutionRoutingPlan({ roleKey: "developer", providerHints: ["cursor"] });
    const b = buildExecutionRoutingPlan({ roleKey: "developer", providerHints: ["cursor"] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("ignores invalid provider hints and falls back to recommendation", () => {
    const plan = buildExecutionRoutingPlan({
      roleKey: "developer",
      providerHints: ["not-a-provider", null, undefined, ""],
    });
    for (const item of plan.items) {
      expect(item.provider).toBe("cursor");
      expect(item.reason).toBe("role_policy_recommended:cursor");
      expect(item.enabled).toBe(true);
    }
  });

  it("summary derives from plan items", () => {
    const plan = buildExecutionRoutingPlan({ roleKey: "reviewer" });
    const summary = summarizeExecutionRoutingPlan(plan);
    expect(summary.mode).toBe("dry_run");
    expect(summary.total).toBe(2);
    expect(summary.roles).toBe(1);
    expect(summary.providers).toBe(1);
    expect(summary.capabilities).toBe(2);
    expect(summary.enabledCount).toBe(2);
    expect(summary.disabledCount).toBe(0);
  });
});
