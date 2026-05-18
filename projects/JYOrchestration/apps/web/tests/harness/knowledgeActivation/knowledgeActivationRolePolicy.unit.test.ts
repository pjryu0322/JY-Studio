import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_ACTIVATION_ROLE_POLICY,
  asKnowledgeActivationPriority,
  listKnowledgeActivationRolePolicies,
  resolveKnowledgeActivationRolePolicy,
} from "@/lib/harness/knowledgeActivation/knowledgeActivationRolePolicy";

describe("resolveKnowledgeActivationRolePolicy", () => {
  it("returns an empty list for null / empty role keys", () => {
    expect(resolveKnowledgeActivationRolePolicy(null)).toEqual([]);
    expect(resolveKnowledgeActivationRolePolicy(undefined)).toEqual([]);
    expect(resolveKnowledgeActivationRolePolicy("")).toEqual([]);
    expect(resolveKnowledgeActivationRolePolicy("   ")).toEqual([]);
  });

  it("normalizes role keys with prefixes and casing", () => {
    const planner = resolveKnowledgeActivationRolePolicy("AI_PLANNER");
    expect(planner.length).toBeGreaterThan(0);
    expect(planner).toBe(KNOWLEDGE_ACTIVATION_ROLE_POLICY.planner);

    const architect = resolveKnowledgeActivationRolePolicy("ai-Architect");
    expect(architect).toBe(KNOWLEDGE_ACTIVATION_ROLE_POLICY.architect);
  });

  it("returns an empty list for unknown roles", () => {
    expect(resolveKnowledgeActivationRolePolicy("unknown")).toEqual([]);
    expect(resolveKnowledgeActivationRolePolicy("ai-random")).toEqual([]);
  });

  it("uses kebab-case knowledgePackId for all registered policies", () => {
    for (const refs of Object.values(KNOWLEDGE_ACTIVATION_ROLE_POLICY)) {
      for (const ref of refs) {
        expect(ref.knowledgePackId).toMatch(/^[a-z0-9-]+$/);
        expect(["required", "recommended", "optional"]).toContain(ref.priority);
      }
    }
  });

  it("includes the expected baseline roles", () => {
    expect(KNOWLEDGE_ACTIVATION_ROLE_POLICY).toHaveProperty("planner");
    expect(KNOWLEDGE_ACTIVATION_ROLE_POLICY).toHaveProperty("architect");
    expect(KNOWLEDGE_ACTIVATION_ROLE_POLICY).toHaveProperty("developer");
    expect(KNOWLEDGE_ACTIVATION_ROLE_POLICY).toHaveProperty("security");
    expect(KNOWLEDGE_ACTIVATION_ROLE_POLICY).toHaveProperty("reviewer");
  });

  it("sorts policies alphabetically when listed", () => {
    const keys = listKnowledgeActivationRolePolicies().map(([k]) => k);
    expect(keys).toEqual([...keys].sort());
  });

  it("asKnowledgeActivationPriority filters invalid values", () => {
    expect(asKnowledgeActivationPriority("required")).toBe("required");
    expect(asKnowledgeActivationPriority("recommended")).toBe("recommended");
    expect(asKnowledgeActivationPriority("optional")).toBe("optional");
    expect(asKnowledgeActivationPriority("REQUIRED")).toBeNull();
    expect(asKnowledgeActivationPriority("garbage")).toBeNull();
  });
});
