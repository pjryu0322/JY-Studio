import { describe, expect, it } from "vitest";
import {
  parseKnowledgeGraphRevisionSnapshot,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionSnapshot";
import { knowledgeGraphSnapshotToCanvasGraph } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionUi";

describe("parseKnowledgeGraphRevisionSnapshot", () => {
  it("parses valid snapshot", () => {
    const parsed = parseKnowledgeGraphRevisionSnapshot({
      nodes: [{ entityKey: "ek1", nodeType: "Feature", title: "기능", summary: null }],
      edges: [{ fromEntityKey: "ek1", toEntityKey: "ek2", edgeType: "LINK" }],
    });
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.edges).toHaveLength(1);
  });

  it("returns empty for invalid input", () => {
    expect(parseKnowledgeGraphRevisionSnapshot(null).nodes).toEqual([]);
    expect(parseKnowledgeGraphRevisionSnapshot("x").edges).toEqual([]);
  });
});

describe("knowledgeGraphSnapshotToCanvasGraph", () => {
  it("maps entity keys to canvas ids without exposing raw keys in titles", () => {
    const { nodes, edges } = knowledgeGraphSnapshotToCanvasGraph({
      nodes: [
        { entityKey: "secret-key", nodeType: "Feature", title: "회의록 업로드", summary: null },
        { entityKey: "other", nodeType: "Screen", title: "화면", summary: null },
      ],
      edges: [{ fromEntityKey: "secret-key", toEntityKey: "other", edgeType: "IMPACTS" }],
    });
    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.title).toBe("회의록 업로드");
    expect(nodes[0]?.id.startsWith("rev:")).toBe(true);
    expect(edges).toHaveLength(1);
    expect(edges[0]?.edgeType).toBe("IMPACTS");
  });
});
