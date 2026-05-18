import { describe, expect, it } from "vitest";

import { deriveKnowledgeActivationTaskTypeFromMeta } from "@/lib/harness/knowledgeActivation/deriveKnowledgeActivationTaskType";

describe("deriveKnowledgeActivationTaskTypeFromMeta", () => {
  it("returns null when nothing matches", () => {
    expect(
      deriveKnowledgeActivationTaskTypeFromMeta({
        decisionAxis: null,
        roleKey: null,
        workspaceStage: null,
      })
    ).toBeNull();
  });

  it("prefers decisionAxis when it matches a known task type", () => {
    expect(
      deriveKnowledgeActivationTaskTypeFromMeta({
        decisionAxis: "review",
        roleKey: "developer",
        workspaceStage: "prototype-build",
      })
    ).toBe("review");
  });

  it("falls back to role-derived task type when decisionAxis is unknown", () => {
    expect(
      deriveKnowledgeActivationTaskTypeFromMeta({
        decisionAxis: "vibe",
        roleKey: "developer",
        workspaceStage: null,
      })
    ).toBe("development");
  });

  it("falls back to stage-derived task type when role is also unknown", () => {
    expect(
      deriveKnowledgeActivationTaskTypeFromMeta({
        decisionAxis: null,
        roleKey: "unknown",
        workspaceStage: "security-review",
      })
    ).toBe("security");
  });

  it("normalizes casing and separators", () => {
    expect(
      deriveKnowledgeActivationTaskTypeFromMeta({
        decisionAxis: "Architecture",
        roleKey: null,
        workspaceStage: null,
      })
    ).toBe("architecture");
    expect(
      deriveKnowledgeActivationTaskTypeFromMeta({
        decisionAxis: null,
        roleKey: null,
        workspaceStage: "Idea Refinement",
      })
    ).toBe("planning");
  });
});
