import { describe, expect, it } from "vitest";
import {
  applyGraphExplorationQuery,
  buildKnowledgeGraphHref,
  buildUndirectedAdjacency,
  computeImpactZones,
  findGraphNodeIdsForSourceMessageId,
  parseGraphQuestionQuery,
} from "@/lib/project-graph/projectGraphExploration";

describe("projectGraphExploration", () => {
  const nodes = [
    {
      id: "r1",
      nodeType: "Requirement",
      title: "Login",
      summary: null,
      explainability: {
        reason: "because",
        confidence: 80,
        confidenceLabel: "HIGH" as const,
        confidenceReason: "x",
        sourceConversation: { excerpt: "hi", messageId: "msg-1", href: "/r" },
        sourceEvent: { eventType: "conversation.message_created", eventId: "e1" },
        createdBy: "AI",
        createdFrom: { eventId: "e1", messageId: "msg-1" },
        relatedNodes: [],
        relatedArtifacts: {
          reviews: [],
          screens: [],
          features: [],
          flows: [],
          tasks: [],
          changeRequests: [],
        },
      },
    },
    {
      id: "f1",
      nodeType: "Feature",
      title: "Auth",
      summary: null,
    },
  ];

  it("parses Korean question queries", () => {
    expect(parseGraphQuestionQuery("왜 생성되었는가?").questionId).toBe("why-created");
    expect(parseGraphQuestionQuery("어떤 기능과 연결되는가?").nodeTypeFilter).toBe("Feature");
  });

  it("applies question navigation to nodes", () => {
    const q = parseGraphQuestionQuery("왜 생성되었는가?");
    const { nodes: out, highlightIds } = applyGraphExplorationQuery(nodes, q);
    expect(out.length).toBeGreaterThan(0);
    expect(highlightIds.has("r1")).toBe(true);
  });

  it("finds nodes by source message id", () => {
    expect(findGraphNodeIdsForSourceMessageId(nodes, "msg-1")).toEqual(["r1"]);
  });

  it("builds graph deep links for chat navigation", () => {
    const href = buildKnowledgeGraphHref("p1", { sourceMessageId: "m9" });
    expect(href).toContain("knowledge-graph");
    expect(href).toContain("sourceMessageId=m9");
  });

  it("computes impact zones depth 1 and 2", () => {
    const edges = [{ id: "e1", fromNodeId: "r1", toNodeId: "f1", edgeType: "RELATES" }];
    const adj = buildUndirectedAdjacency(edges);
    const impact = computeImpactZones("r1", adj, 2);
    expect(impact.depth1.has("f1")).toBe(true);
  });
});
