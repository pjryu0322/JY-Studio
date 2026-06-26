import { describe, expect, it } from "vitest";
import {
  parseKnowledgeGraphRevisionSnapshot,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionSnapshot";
import { knowledgeGraphSnapshotToCanvasGraph } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionUi";
import { resolveAgentRelevanceFromNode } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";

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

  it("preserves agentRelevance when parsing revision snapshot", () => {
    const parsed = parseKnowledgeGraphRevisionSnapshot({
      nodes: [
        {
          entityKey: "feature:upload",
          nodeType: "FEATURE",
          title: "파일 업로드",
          summary: "회의록 파일 업로드",
          agentRelevance: {
            security: {
              relevance: 0.8,
              useAs: "risk",
              reason: "파일 업로드 보안 위험",
              promptSummary: "파일 업로드 검증 기준 필요",
            },
          },
        },
      ],
      edges: [],
    });

    expect(parsed.nodes[0]?.agentRelevance?.security?.useAs).toBe("risk");
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

  it("preserves agentRelevance when converting revision snapshot to canvas graph", () => {
    const { nodes } = knowledgeGraphSnapshotToCanvasGraph({
      nodes: [
        {
          entityKey: "screen:login",
          nodeType: "SCREEN",
          title: "로그인 화면",
          summary: null,
          agentRelevance: {
            developer: {
              relevance: 0.7,
              useAs: "implementation_hint",
              reason: "화면 구현",
              promptSummary: "로그인 화면 컴포넌트 필요",
            },
          },
        },
      ],
      edges: [],
    });

    expect(resolveAgentRelevanceFromNode(nodes[0]).developer?.useAs).toBe("implementation_hint");
  });
});
