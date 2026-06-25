import { describe, expect, it } from "vitest";
import {
  assertMvpReferenceSnapshotIdCount,
  normalizeReferenceSnapshotIds,
  ReferenceSnapshotSelectionValidationError,
} from "@/lib/project-knowledge/projectKnowledgeReferenceSelectionValidation";
import { buildProjectReferencePlanningContext, formatProjectReferencePlanningContextForPrompt } from "@/lib/project-knowledge/projectKnowledgeReferenceContextBuilder";

describe("projectReferenceSelectionValidation", () => {
  it("rejects more than one snapshot id for MVP", () => {
    expect(() => assertMvpReferenceSnapshotIdCount(["a", "b"])).toThrow(ReferenceSnapshotSelectionValidationError);
  });

  it("normalizes snapshot id array", () => {
    expect(normalizeReferenceSnapshotIds([" a ", "", "a"])).toEqual(["a"]);
  });
});

describe("projectKnowledgeReferenceContextBuilder", () => {
  it("excludes unsafe uuid-like titles from context sections", () => {
    const ctx = buildProjectReferencePlanningContext([
      {
        purpose: "REFERENCE_CANDIDATE",
        nodes: [
          {
            entityKey: "1",
            nodeType: "Feature",
            title: "550e8400-e29b-41d4-a716-446655440000",
            summary: null,
            reference: {
              lifecycle: "USER_APPROVED",
              reusable: true,
              reusableAs: ["FEATURE"],
              safeForReference: true,
            },
          },
          {
            entityKey: "2",
            nodeType: "Actor",
            title: "고객",
            summary: null,
            reference: {
              lifecycle: "USER_APPROVED",
              reusable: true,
              reusableAs: ["ACTOR"],
              safeForReference: true,
            },
          },
        ],
        edges: [],
      },
    ]);
    const text = formatProjectReferencePlanningContextForPrompt(ctx);
    expect(text).toContain("고객");
    expect(text).not.toContain("550e8400-e29b-41d4-a716-446655440000");
    expect(text).not.toMatch(/eventId|revisionId|nodeId|pipelineRunId/i);
  });

  it("includes reference guidance and no raw conversation markers", () => {
    const ctx = buildProjectReferencePlanningContext([
      {
        purpose: "REFERENCE_CANDIDATE",
        nodes: [
          {
            entityKey: "a",
            nodeType: "Actor",
            title: "관리자",
            summary: null,
            reference: {
              lifecycle: "USER_APPROVED",
              reusable: true,
              reusableAs: ["ACTOR"],
              safeForReference: true,
            },
          },
        ],
        edges: [],
      },
    ]);
    const text = formatProjectReferencePlanningContextForPrompt(ctx);
    expect(text).toContain("복사하기 위한 것이 아니라");
    expect(text).not.toContain("raw conversation");
  });
});
