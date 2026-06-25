import { describe, expect, it } from "vitest";
import { parseKnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionSnapshot";
import { buildReusableAssetsFromReferenceSnapshot } from "@/lib/project-knowledge/projectKnowledgeReferenceSnapshotAssets";

describe("parseKnowledgeGraphRevisionSnapshot reference nodes", () => {
  it("parses snapshot node reference metadata", () => {
    const parsed = parseKnowledgeGraphRevisionSnapshot({
      purpose: "REFERENCE_CANDIDATE",
      nodes: [
        {
          entityKey: "a",
          nodeType: "Feature",
          title: "기능",
          summary: null,
          reference: {
            lifecycle: "USER_APPROVED",
            reusable: true,
            reusableAs: ["FEATURE"],
            safeForReference: true,
          },
        },
      ],
      edges: [],
    });
    expect(parsed.nodes[0]?.reference?.reusableAs).toContain("FEATURE");
  });

  it("legacy snapshot without reference still parses", () => {
    const parsed = parseKnowledgeGraphRevisionSnapshot({
      nodes: [{ entityKey: "a", nodeType: "Feature", title: "기능", summary: null }],
      edges: [],
    });
    expect(parsed.nodes[0]?.reference).toBeUndefined();
  });
});

describe("buildReusableAssetsFromReferenceSnapshot", () => {
  it("classifies by reusableAs and excludes unsafe nodes", () => {
    const assets = buildReusableAssetsFromReferenceSnapshot({
      purpose: "REFERENCE_CANDIDATE",
      nodes: [
        {
          entityKey: "1",
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
        {
          entityKey: "2",
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
      ],
      edges: [],
    });
    expect(assets.actors).toContain("고객");
    expect(assets.features).not.toContain("550e8400-e29b-41d4-a716-446655440000");
  });

  it("graphSummary count matches snapshot reusable safe nodes included in assets", () => {
    const assets = buildReusableAssetsFromReferenceSnapshot({
      purpose: "REFERENCE_CANDIDATE",
      nodes: [
        {
          entityKey: "1",
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
        {
          entityKey: "2",
          nodeType: "ServiceFlow",
          title: "주문 흐름",
          summary: null,
          reference: {
            lifecycle: "USER_APPROVED",
            reusable: true,
            reusableAs: ["SERVICE_FLOW"],
            safeForReference: true,
          },
        },
        {
          entityKey: "3",
          nodeType: "Feature",
          title: "주문 기능",
          summary: null,
          reference: {
            lifecycle: "USER_APPROVED",
            reusable: true,
            reusableAs: ["FEATURE"],
            safeForReference: true,
          },
        },
      ],
      edges: [],
    });
    expect(assets.graphSummary).toContain("항목 3개");
  });
});
