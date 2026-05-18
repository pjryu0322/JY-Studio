import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_ACTIVATION_STAGE_POLICY,
  listKnowledgeActivationStageKeys,
  resolveKnowledgeActivationStagePolicy,
} from "@/lib/harness/knowledgeActivation/knowledgeActivationStagePolicy";

describe("resolveKnowledgeActivationStagePolicy", () => {
  it("returns empty for null / undefined / empty workspace stage", () => {
    expect(resolveKnowledgeActivationStagePolicy(null)).toEqual([]);
    expect(resolveKnowledgeActivationStagePolicy(undefined)).toEqual([]);
    expect(resolveKnowledgeActivationStagePolicy("   ")).toEqual([]);
  });

  it("maps canonical kebab-case stage keys", () => {
    expect(resolveKnowledgeActivationStagePolicy("idea-refinement")).toBe(
      KNOWLEDGE_ACTIVATION_STAGE_POLICY["idea-refinement"]
    );
    expect(resolveKnowledgeActivationStagePolicy("prototype-build")).toBe(
      KNOWLEDGE_ACTIVATION_STAGE_POLICY["prototype-build"]
    );
  });

  it("normalizes legacy / alias stage values", () => {
    expect(resolveKnowledgeActivationStagePolicy("ideation")).toBe(
      KNOWLEDGE_ACTIVATION_STAGE_POLICY["idea-refinement"]
    );
    expect(resolveKnowledgeActivationStagePolicy("Service Flow")).toBe(
      KNOWLEDGE_ACTIVATION_STAGE_POLICY["service-flow"]
    );
    expect(resolveKnowledgeActivationStagePolicy("development")).toBe(
      KNOWLEDGE_ACTIVATION_STAGE_POLICY["prototype-build"]
    );
    expect(resolveKnowledgeActivationStagePolicy("security")).toBe(
      KNOWLEDGE_ACTIVATION_STAGE_POLICY["security-review"]
    );
  });

  it("returns empty for unrecognized stages", () => {
    expect(resolveKnowledgeActivationStagePolicy("random-phase")).toEqual([]);
    expect(resolveKnowledgeActivationStagePolicy("ideation-x")).toEqual([]);
  });

  it("uses kebab-case ids for all stage policies", () => {
    for (const refs of Object.values(KNOWLEDGE_ACTIVATION_STAGE_POLICY)) {
      for (const ref of refs) {
        expect(ref.knowledgePackId).toMatch(/^[a-z0-9-]+$/);
        expect(["required", "recommended", "optional"]).toContain(ref.priority);
      }
    }
  });

  it("sorts stage keys deterministically", () => {
    const keys = listKnowledgeActivationStageKeys();
    expect(keys).toEqual([...keys].sort());
  });
});
