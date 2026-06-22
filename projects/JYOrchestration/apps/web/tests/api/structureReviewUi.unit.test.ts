import { describe, expect, it } from "vitest";
import {
  candidateCanMerge,
  filterStructureCandidates,
  graphReflectionStatusLabel,
  groupStructureConflicts,
  resolveGraphReflectionStatus,
} from "@/lib/project-structure/structureReviewViewModel";
import type { StructureCandidateRow, StructureConflictRow } from "@/lib/project-structure/structureReviewUiTypes";

function cand(partial: Partial<StructureCandidateRow> & Pick<StructureCandidateRow, "id">): StructureCandidateRow {
  return {
    projectId: "p1",
    idempotencyKey: "k",
    nodeType: "Requirement",
    title: "t",
    summary: "s",
    lifecycleStatus: "CANDIDATE",
    sourceEventId: null,
    fingerprint: null,
    approvedGraphNodeId: null,
    metadata: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("structureReviewViewModel", () => {
  it("filters by lifecycle and node type", () => {
    const list = [
      cand({ id: "1", lifecycleStatus: "CANDIDATE", nodeType: "Requirement" }),
      cand({ id: "2", lifecycleStatus: "APPROVED", nodeType: "Feature" }),
    ];
    expect(filterStructureCandidates(list, { lifecycle: "CANDIDATE" })).toHaveLength(1);
    expect(filterStructureCandidates(list, { nodeType: "Feature" })).toHaveLength(1);
  });

  it("resolves graph reflection status", () => {
    expect(resolveGraphReflectionStatus({ lifecycleStatus: "CANDIDATE", approvedGraphNodeId: null })).toBe(
      "not_reflected",
    );
    expect(
      resolveGraphReflectionStatus({ lifecycleStatus: "APPROVED", approvedGraphNodeId: "gn1" }),
    ).toBe("graph_applied");
    expect(graphReflectionStatusLabel("graph_applied")).toContain("Graph");
  });

  it("groups conflicts by kind", () => {
    const conflicts: StructureConflictRow[] = [
      { kind: "duplicate_requirement", candidateIds: ["a", "b"], score: 1, message: "dup" },
      { kind: "similar_node", candidateIds: ["c", "d"], score: 0.8, message: "sim" },
    ];
    const grouped = groupStructureConflicts(conflicts);
    expect(grouped.get("duplicate_requirement")).toHaveLength(1);
    expect(candidateCanMerge("a", conflicts)).toBe(true);
    expect(candidateCanMerge("z", conflicts)).toBe(false);
  });
});
