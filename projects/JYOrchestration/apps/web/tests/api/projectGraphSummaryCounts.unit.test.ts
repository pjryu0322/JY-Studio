import { describe, expect, it } from "vitest";
import { computeProjectGraphSummaryCounts } from "@/lib/project-graph/projectGraphSummaryCounts";

describe("computeProjectGraphSummaryCounts", () => {
  it("counts node types for summary badges", () => {
    const counts = computeProjectGraphSummaryCounts(
      [
        { id: "1", nodeType: "Requirement", title: "R1", summary: null },
        { id: "2", nodeType: "Requirement", title: "R2", summary: null },
        { id: "3", nodeType: "Feature", title: "F1", summary: null },
        { id: "4", nodeType: "Actor", title: "A1", summary: null },
      ],
      [
        { id: "e1", fromNodeId: "1", toNodeId: "2", edgeType: "LINK" },
        { id: "e2", fromNodeId: "2", toNodeId: "3", edgeType: "LINK" },
      ],
    );
    expect(counts.nodes).toBe(4);
    expect(counts.edges).toBe(2);
    expect(counts.requirements).toBe(2);
    expect(counts.features).toBe(1);
    expect(counts.actors).toBe(1);
  });
});
