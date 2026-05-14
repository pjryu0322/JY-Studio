import { describe, expect, it } from "vitest";

import {
  MEMORY_RUNTIME_DEFAULT_POLICY,
  listMemoryRuntimeRolePolicies,
  resolveMemoryRuntimeRolePolicy,
} from "@/lib/harness/memoryRuntime/memoryRuntimeRolePolicy";

describe("resolveMemoryRuntimeRolePolicy", () => {
  it("returns the default policy for empty/null/whitespace role keys", () => {
    expect(resolveMemoryRuntimeRolePolicy(null)).toBe(MEMORY_RUNTIME_DEFAULT_POLICY);
    expect(resolveMemoryRuntimeRolePolicy(undefined)).toBe(MEMORY_RUNTIME_DEFAULT_POLICY);
    expect(resolveMemoryRuntimeRolePolicy("")).toBe(MEMORY_RUNTIME_DEFAULT_POLICY);
    expect(resolveMemoryRuntimeRolePolicy("   ")).toBe(MEMORY_RUNTIME_DEFAULT_POLICY);
  });

  it("normalizes role keys with prefixes and casing", () => {
    const planner = resolveMemoryRuntimeRolePolicy("AI_PLANNER");
    expect(planner.roleKey).toBe("planner");
    const architect = resolveMemoryRuntimeRolePolicy("ai-Architect");
    expect(architect.roleKey).toBe("architect");
    const security = resolveMemoryRuntimeRolePolicy("AI Security");
    expect(security.roleKey).toBe("security");
  });

  it("returns the default policy for unknown roles", () => {
    expect(resolveMemoryRuntimeRolePolicy("unknown_role_xyz")).toBe(MEMORY_RUNTIME_DEFAULT_POLICY);
  });

  it("planner prioritizes project/role scopes and goal/ux keywords", () => {
    const planner = resolveMemoryRuntimeRolePolicy("planner");
    expect(planner.preferredScopes[0]).toBe("project");
    expect(planner.preferredScopes).toContain("role");
    expect(planner.keywordHints).toContain("ux");
    expect(planner.keywordHints).toContain("goal");
  });

  it("security prioritizes platform and security keywords", () => {
    const security = resolveMemoryRuntimeRolePolicy("security");
    expect(security.preferredScopes).toContain("platform");
    expect(security.keywordHints).toContain("security");
  });

  it("lists policies alphabetically by roleKey", () => {
    const list = listMemoryRuntimeRolePolicies();
    const keys = list.map((p) => p.roleKey);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
    expect(list.length).toBeGreaterThanOrEqual(5);
  });
});
