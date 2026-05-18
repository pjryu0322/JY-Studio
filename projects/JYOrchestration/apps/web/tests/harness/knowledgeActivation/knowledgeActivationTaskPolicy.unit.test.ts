import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_ACTIVATION_TASK_POLICY,
  listKnowledgeActivationTaskTypes,
  resolveKnowledgeActivationTaskPolicy,
} from "@/lib/harness/knowledgeActivation/knowledgeActivationTaskPolicy";

describe("resolveKnowledgeActivationTaskPolicy", () => {
  it("returns empty for null / empty task types", () => {
    expect(resolveKnowledgeActivationTaskPolicy(null)).toEqual([]);
    expect(resolveKnowledgeActivationTaskPolicy(undefined)).toEqual([]);
    expect(resolveKnowledgeActivationTaskPolicy("")).toEqual([]);
    expect(resolveKnowledgeActivationTaskPolicy("  ")).toEqual([]);
  });

  it("resolves all canonical task types", () => {
    for (const t of listKnowledgeActivationTaskTypes()) {
      expect(resolveKnowledgeActivationTaskPolicy(t)).toBe(KNOWLEDGE_ACTIVATION_TASK_POLICY[t]);
    }
  });

  it("normalizes role-style aliases", () => {
    expect(resolveKnowledgeActivationTaskPolicy("developer")).toBe(
      KNOWLEDGE_ACTIVATION_TASK_POLICY.development
    );
    expect(resolveKnowledgeActivationTaskPolicy("reviewer")).toBe(
      KNOWLEDGE_ACTIVATION_TASK_POLICY.review
    );
    expect(resolveKnowledgeActivationTaskPolicy("secops")).toBe(
      KNOWLEDGE_ACTIVATION_TASK_POLICY.security
    );
  });

  it("returns empty for unknown task type strings", () => {
    expect(resolveKnowledgeActivationTaskPolicy("research")).toEqual([]);
    expect(resolveKnowledgeActivationTaskPolicy("magic")).toEqual([]);
  });

  it("uses kebab-case ids and valid priorities", () => {
    for (const refs of Object.values(KNOWLEDGE_ACTIVATION_TASK_POLICY)) {
      for (const ref of refs) {
        expect(ref.knowledgePackId).toMatch(/^[a-z0-9-]+$/);
        expect(["required", "recommended", "optional"]).toContain(ref.priority);
      }
    }
  });
});
