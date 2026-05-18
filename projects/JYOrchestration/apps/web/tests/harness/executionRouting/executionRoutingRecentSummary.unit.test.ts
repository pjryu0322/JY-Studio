import { describe, expect, it } from "vitest";

import type {
  ExecutionRoutingPlan,
  ExecutionRoutingPlanItem,
} from "@/lib/harness/executionRouting/executionCapabilityTypes";
import {
  emptyRecentExecutionRoutingSummary,
  summarizeRecentExecutionRoutingPlans,
} from "@/lib/harness/executionRouting/executionRoutingRecentSummary";

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

function makePlan(items: readonly ExecutionRoutingPlanItem[], findingsCount = 0): ExecutionRoutingPlan {
  return {
    mode: "dry_run",
    roleKey: "planner",
    workspaceStage: null,
    items,
    findings: Array.from({ length: findingsCount }, (_, i) => ({
      code: `F${i}`,
      severity: "info",
      message: `f${i}`,
    })),
  };
}

describe("summarizeRecentExecutionRoutingPlans", () => {
  it("returns empty for [] input", () => {
    expect(summarizeRecentExecutionRoutingPlans({ plans: [] })).toEqual(
      emptyRecentExecutionRoutingSummary()
    );
  });

  it("counts sampled entries even when plans are null/invalid", () => {
    const r = summarizeRecentExecutionRoutingPlans({
      plans: [null, undefined, makePlan([]), { mode: "apply", items: [] } as unknown as ExecutionRoutingPlan],
    });
    expect(r.sampledEntryCount).toBe(4);
    expect(r.planEntryCount).toBe(1);
    expect(r.totalItems).toBe(0);
  });

  it("computes item-level rates from valid plans", () => {
    const planA = makePlan([
      makeItem({ enabled: true }),
      makeItem({
        capability: "cursor_execution",
        provider: "cursor",
        enabled: true,
        reason: "role_policy_recommended:cursor",
      }),
    ]);
    const planB = makePlan([
      makeItem({
        capability: "github_operation",
        provider: "github",
        enabled: true,
        reason: "role_policy_recommended:github",
      }),
      makeItem({
        capability: "code_generation",
        provider: "unknown",
        enabled: false,
        warning: "x",
        reason: "no_provider_recommendation",
      }),
    ]);
    const r = summarizeRecentExecutionRoutingPlans({ plans: [planA, planB] });
    expect(r.sampledEntryCount).toBe(2);
    expect(r.planEntryCount).toBe(2);
    expect(r.totalItems).toBe(4);
    expect(r.disabledItemRate).toBe(0.25);
    expect(r.warningItemRate).toBe(0.25);
    expect(r.unknownProviderRate).toBe(0.25);
    expect(r.cursorCapabilityRate).toBe(0.5);
    expect(r.githubCapabilityRate).toBe(0.25);
  });

  it("computes plan-level finding rate", () => {
    const planA = makePlan([makeItem()], 1);
    const planB = makePlan([makeItem()], 0);
    const planC = makePlan([makeItem()], 2);
    const r = summarizeRecentExecutionRoutingPlans({ plans: [planA, planB, planC] });
    expect(r.findingRate).toBeCloseTo(2 / 3, 4);
  });

  it("rounds rates to 4 decimals", () => {
    const items = Array.from({ length: 7 }, () => makeItem({ enabled: true }));
    items[0] = makeItem({ enabled: false, warning: "x", reason: "provider_hint_unsupported:cursor" });
    const r = summarizeRecentExecutionRoutingPlans({ plans: [makePlan(items)] });
    expect(r.disabledItemRate).toBeCloseTo(1 / 7, 4);
  });

  it("does not double-count when items is empty", () => {
    const r = summarizeRecentExecutionRoutingPlans({ plans: [makePlan([])] });
    expect(r.planEntryCount).toBe(1);
    expect(r.totalItems).toBe(0);
    expect(r.disabledItemRate).toBe(0);
    expect(r.warningItemRate).toBe(0);
  });
});
