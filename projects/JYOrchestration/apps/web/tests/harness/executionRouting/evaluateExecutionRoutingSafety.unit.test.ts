import { describe, expect, it } from "vitest";

import { buildExecutionRoutingPlan } from "@/lib/harness/executionRouting/buildExecutionRoutingPlan";
import type {
  ExecutionRoutingPlan,
  ExecutionRoutingPlanItem,
} from "@/lib/harness/executionRouting/executionCapabilityTypes";
import {
  EXECUTION_ROUTING_SAFETY_UNSAFE_RATE,
  evaluateExecutionRoutingSafety,
} from "@/lib/harness/executionRouting/evaluateExecutionRoutingSafety";

function makeItem(overrides: Partial<ExecutionRoutingPlanItem> = {}): ExecutionRoutingPlanItem {
  return {
    roleKey: "planner",
    capability: "planning",
    provider: "openai",
    enabled: true,
    reason: "role_policy_recommended:openai",
    ...overrides,
  };
}

function makePlan(items: readonly ExecutionRoutingPlanItem[]): ExecutionRoutingPlan {
  return {
    mode: "dry_run",
    roleKey: "planner",
    workspaceStage: null,
    items,
    findings: [],
  };
}

describe("evaluateExecutionRoutingSafety", () => {
  it("returns safe_dry_run for null/undefined/empty plan with safety pin finding", () => {
    const a = evaluateExecutionRoutingSafety({ plan: null });
    const b = evaluateExecutionRoutingSafety({ plan: undefined });
    for (const r of [a, b]) {
      expect(r.mode).toBe("dry_run_safety");
      expect(r.status).toBe("safe_dry_run");
      expect(r.providerSwitchingEnabled).toBe(false);
      expect(r.executionBlockingEnabled).toBe(false);
      expect(r.automaticExecutionEnabled).toBe(false);
      expect(r.totalItems).toBe(0);
      expect(r.findings.length).toBe(0);
    }
  });

  it("returns unsafe_to_apply when plan.mode is not dry_run", () => {
    const r = evaluateExecutionRoutingSafety({
      plan: { ...makePlan([]), mode: "apply" as unknown as "dry_run" },
    });
    expect(r.status).toBe("unsafe_to_apply");
    expect(r.findings.some((f) => f.code === "MODE_NOT_DRY_RUN")).toBe(true);
  });

  it("returns safe_dry_run when plan has only enabled items and no warnings", () => {
    const plan = buildExecutionRoutingPlan({ roleKey: "planner" });
    const r = evaluateExecutionRoutingSafety({ plan });
    expect(r.status).toBe("safe_dry_run");
    expect(r.unsupportedCapabilityCount).toBe(0);
    expect(r.warningItemCount).toBe(0);
    expect(r.findings.some((f) => f.code === "DRY_RUN_SAFETY_PIN")).toBe(true);
  });

  it("returns watch when there is at least one disabled or warning item", () => {
    const plan = makePlan([
      makeItem({ enabled: true }),
      makeItem({
        capability: "analysis",
        enabled: false,
        warning: "provider does not support",
        reason: "provider_hint_unsupported:cursor",
      }),
      makeItem({ capability: "design_review" }),
      makeItem({ capability: "code_review" }),
    ]);
    const r = evaluateExecutionRoutingSafety({ plan });
    expect(r.status).toBe("watch");
    expect(r.unsupportedCapabilityCount).toBe(1);
    expect(r.warningItemCount).toBe(1);
    expect(r.providerHintCount).toBe(1);
  });

  it("returns unsafe_to_apply when disabled rate >= 50%", () => {
    const plan = makePlan([
      makeItem({ enabled: false, warning: "x", reason: "provider_hint_unsupported:cursor" }),
      makeItem({ capability: "analysis", enabled: true }),
    ]);
    const r = evaluateExecutionRoutingSafety({ plan });
    expect(r.status).toBe("unsafe_to_apply");
    expect(r.findings.some((f) => f.code === "HIGH_DISABLED_RATE")).toBe(true);
  });

  it("returns unsafe_to_apply when warning rate >= 50%", () => {
    const plan = makePlan([
      makeItem({ enabled: true, warning: "soft note" }),
      makeItem({ capability: "analysis", enabled: true }),
    ]);
    const r = evaluateExecutionRoutingSafety({ plan });
    expect(r.status).toBe("unsafe_to_apply");
    expect(r.findings.some((f) => f.code === "HIGH_WARNING_RATE")).toBe(true);
  });

  it("returns unsafe_to_apply when unknown provider is paired with sensitive capability", () => {
    const plan = makePlan([
      makeItem({
        capability: "cursor_execution",
        provider: "unknown",
        enabled: false,
        warning: "no recommendation",
        reason: "no_provider_recommendation",
      }),
      makeItem({ capability: "analysis", enabled: true }),
    ]);
    const r = evaluateExecutionRoutingSafety({ plan });
    expect(r.status).toBe("unsafe_to_apply");
    expect(
      r.findings.some((f) => f.code === "UNKNOWN_PROVIDER_SENSITIVE_CAPABILITY")
    ).toBe(true);
  });

  it("provider switching / blocking / automatic execution flags are always false", () => {
    const plan = makePlan([makeItem()]);
    const r = evaluateExecutionRoutingSafety({ plan });
    expect(r.providerSwitchingEnabled).toBe(false);
    expect(r.executionBlockingEnabled).toBe(false);
    expect(r.automaticExecutionEnabled).toBe(false);
  });

  it("constant threshold is 0.5 (boundary test)", () => {
    expect(EXECUTION_ROUTING_SAFETY_UNSAFE_RATE).toBe(0.5);
  });
});
