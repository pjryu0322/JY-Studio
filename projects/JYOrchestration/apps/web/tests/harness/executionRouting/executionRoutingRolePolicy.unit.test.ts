import { describe, expect, it } from "vitest";

import {
  EXECUTION_ROUTING_ROLE_POLICY,
  listExecutionRoutingRoleKeys,
  normalizeExecutionRoutingRoleKey,
  resolveExecutionRoutingRolePolicy,
} from "@/lib/harness/executionRouting/executionRoutingRolePolicy";

describe("executionRoutingRolePolicy", () => {
  it("normalizes role keys consistently", () => {
    expect(normalizeExecutionRoutingRoleKey("AI_Planner")).toBe("planner");
    expect(normalizeExecutionRoutingRoleKey("ai-Architect")).toBe("architect");
    expect(normalizeExecutionRoutingRoleKey("  Developer ")).toBe("developer");
    expect(normalizeExecutionRoutingRoleKey(null)).toBe("");
    expect(normalizeExecutionRoutingRoleKey(undefined)).toBe("");
  });

  it("returns role policy for known roles", () => {
    expect(resolveExecutionRoutingRolePolicy("planner")).toEqual(["analysis", "planning"]);
    expect(resolveExecutionRoutingRolePolicy("architect")).toEqual([
      "architecture_review",
      "design_review",
    ]);
    expect(resolveExecutionRoutingRolePolicy("developer")).toEqual([
      "code_generation",
      "cursor_execution",
    ]);
    expect(resolveExecutionRoutingRolePolicy("security")).toEqual(["security_review"]);
    expect(resolveExecutionRoutingRolePolicy("reviewer")).toEqual([
      "code_review",
      "quality_review",
    ]);
  });

  it("falls back to empty default policy for unknown roles", () => {
    expect(resolveExecutionRoutingRolePolicy("unknown-role")).toEqual([]);
    expect(resolveExecutionRoutingRolePolicy("")).toEqual([]);
    expect(resolveExecutionRoutingRolePolicy(null)).toEqual([]);
  });

  it("policy table is read-only and capability arrays are sorted", () => {
    for (const key of Object.keys(EXECUTION_ROUTING_ROLE_POLICY)) {
      const policy = EXECUTION_ROUTING_ROLE_POLICY[key] ?? [];
      const sorted = [...policy].sort();
      expect(policy).toEqual(sorted);
    }
  });

  it("listExecutionRoutingRoleKeys returns deterministic sorted keys", () => {
    const keys = listExecutionRoutingRoleKeys();
    expect(keys).toEqual([...keys].sort());
    expect(keys).toContain("planner");
    expect(keys).toContain("developer");
  });
});
