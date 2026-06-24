import { describe, expect, it } from "vitest";
import { diffKnowledgeGraphRevisions } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionDiff";
import type { KnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";

const snap = (nodes: KnowledgeGraphRevisionSnapshot["nodes"], edges: KnowledgeGraphRevisionSnapshot["edges"]): KnowledgeGraphRevisionSnapshot => ({
  nodes,
  edges,
});

describe("diffKnowledgeGraphRevisions", () => {
  it("reports no change", () => {
    const a = snap([{ entityKey: "a", nodeType: "Feature", title: "A", summary: null }], []);
    const d = diffKnowledgeGraphRevisions(a, a);
    expect(d.lines).toEqual(["변화 없음"]);
    expect(d.addedNodeCount).toBe(0);
  });

  it("counts added and removed nodes", () => {
    const prev = snap([{ entityKey: "a", nodeType: "Feature", title: "A", summary: null }], []);
    const next = snap(
      [
        { entityKey: "a", nodeType: "Feature", title: "A", summary: null },
        { entityKey: "b", nodeType: "Feature", title: "B", summary: null },
        { entityKey: "c", nodeType: "Screen", title: "C", summary: null },
      ],
      [],
    );
    const d = diffKnowledgeGraphRevisions(prev, next);
    expect(d.addedNodeCount).toBe(2);
    expect(d.lines.some((l) => l.includes("+ 노드 2개"))).toBe(true);
  });

  it("counts removed nodes", () => {
    const prev = snap(
      [
        { entityKey: "a", nodeType: "Feature", title: "A", summary: null },
        { entityKey: "b", nodeType: "Feature", title: "B", summary: null },
      ],
      [],
    );
    const next = snap([{ entityKey: "a", nodeType: "Feature", title: "A", summary: null }], []);
    const d = diffKnowledgeGraphRevisions(prev, next);
    expect(d.removedNodeCount).toBe(1);
    expect(d.lines.some((l) => l.includes("- 노드 1개"))).toBe(true);
  });

  it("counts edge changes", () => {
    const nodes = [
      { entityKey: "a", nodeType: "Feature", title: "A", summary: null },
      { entityKey: "b", nodeType: "Feature", title: "B", summary: null },
    ];
    const prev = snap(nodes, []);
    const next = snap(nodes, [
      { fromEntityKey: "a", toEntityKey: "b", edgeType: "RELATES" },
      { fromEntityKey: "b", toEntityKey: "a", edgeType: "RELATES" },
      { fromEntityKey: "a", toEntityKey: "b", edgeType: "DEPENDS" },
    ]);
    const d = diffKnowledgeGraphRevisions(prev, next);
    expect(d.addedEdgeCount).toBe(3);
    expect(d.lines.some((l) => l.includes("+ 연결 3개"))).toBe(true);
  });

  it("handles null previous snapshot as empty", () => {
    const next = snap([{ entityKey: "x", nodeType: "Feature", title: "X", summary: null }], []);
    const d = diffKnowledgeGraphRevisions(null, next);
    expect(d.addedNodeCount).toBe(1);
  });
});
