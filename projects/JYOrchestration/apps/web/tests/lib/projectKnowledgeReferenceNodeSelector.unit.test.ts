import { describe, expect, it } from "vitest";
import type { KnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";
import { selectReferenceContextNodes } from "@/lib/project-knowledge/projectKnowledgeReferenceNodeSelector";

function node(
  entityKey: string,
  nodeType: string,
  title: string,
  reusableAs: string[],
  opts?: { reusable?: boolean; safe?: boolean },
) {
  return {
    entityKey,
    nodeType,
    title,
    summary: null,
    reference: {
      lifecycle: "USER_APPROVED" as const,
      reusable: opts?.reusable ?? true,
      reusableAs,
      safeForReference: opts?.safe ?? true,
    },
  };
}

const snapshot = (nodes: KnowledgeGraphRevisionSnapshot["nodes"]): KnowledgeGraphRevisionSnapshot => ({
  purpose: "REFERENCE_CANDIDATE",
  nodes,
  edges: [],
});

describe("selectReferenceContextNodes", () => {
  it("prioritizes nodes matching userMessage keywords", () => {
    const snapshots = [
      snapshot([
        node("a1", "Actor", "고객", ["ACTOR"]),
        node("f1", "Feature", "결제", ["FEATURE"]),
        node("s1", "ServiceFlow", "승인 흐름", ["SERVICE_FLOW"]),
      ]),
    ];
    const result = selectReferenceContextNodes({
      userMessage: "고객이 승인하기 전에 관리자가 검토해야 해",
      snapshots,
    });
    expect(result.selectedNodes.length).toBeGreaterThan(0);
    expect(result.selectedNodes.some((n) => n.title.includes("고객") || n.title.includes("승인"))).toBe(true);
  });

  it("excludes unsafe titles and non-reusable nodes", () => {
    const snapshots = [
      snapshot([
        node("bad", "Actor", "sk-live-secret-token", ["ACTOR"]),
        node("nr", "Actor", "정상 액터", ["ACTOR"], { reusable: false }),
        node("ns", "Actor", "안전 액터", ["ACTOR"], { safe: false }),
      ]),
    ];
    const result = selectReferenceContextNodes({
      userMessage: "정상 액터 안전 액터",
      snapshots,
    });
    expect(result.selectedNodes.every((n) => n.title === "안전 액터" || n.title === "정상 액터")).toBe(true);
    expect(result.selectedNodes.some((n) => n.title.includes("token"))).toBe(false);
  });

  it("respects maxNodes limit", () => {
    const snapshots = [
      snapshot(
        Array.from({ length: 12 }, (_, i) => node(`f${i}`, "Feature", `기능${i}`, ["FEATURE"])),
      ),
    ];
    const result = selectReferenceContextNodes({
      userMessage: "기능0 기능1 기능2 기능3 기능4 기능5 기능6 기능7",
      snapshots,
      maxNodes: 3,
    });
    expect(result.selectedNodes.length).toBeLessThanOrEqual(3);
  });

  it("returns empty selection when userMessage is empty", () => {
    const snapshots = [snapshot([node("a", "Actor", "고객", ["ACTOR"])])];
    const result = selectReferenceContextNodes({ userMessage: "", snapshots });
    expect(result.selectedNodes).toHaveLength(0);
  });
});
