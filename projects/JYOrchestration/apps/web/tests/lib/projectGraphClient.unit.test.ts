import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProjectGraph } from "@/lib/project-graph/projectGraphClient";

const originalFetch = global.fetch;

function mockGraphResponse(nodes: unknown[], edges: unknown[] = []) {
  global.fetch = vi.fn(async () =>
    Response.json(
      {
        success: true,
        data: { nodes, edges },
      },
      { status: 200 },
    ),
  ) as typeof fetch;
}

describe("fetchProjectGraph agentRelevance parsing", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("parses top-level agentRelevance", async () => {
    mockGraphResponse([
      {
        id: "node-1",
        nodeType: "FEATURE",
        title: "파일 업로드",
        summary: null,
        agentRelevance: {
          security: {
            relevance: 0.8,
            useAs: "risk",
            reason: "파일 업로드 위험",
            promptSummary: "파일 업로드 검증 기준 필요",
          },
        },
      },
    ]);

    const { nodes } = await fetchProjectGraph("project-1");
    expect(nodes[0]?.agentRelevance?.security?.useAs).toBe("risk");
    expect(nodes[0]).not.toHaveProperty("metadata");
  });

  it("falls back to metadata.agentRelevance", async () => {
    mockGraphResponse([
      {
        id: "node-1",
        nodeType: "FEATURE",
        title: "파일 업로드",
        summary: null,
        metadata: {
          agentRelevance: {
            security: {
              relevance: 0.8,
              useAs: "risk",
              reason: "파일 업로드 위험",
              promptSummary: "파일 업로드 검증 기준 필요",
            },
          },
        },
      },
    ]);

    const { nodes } = await fetchProjectGraph("project-1");
    expect(nodes[0]?.agentRelevance?.security?.useAs).toBe("risk");
    expect(nodes[0]).not.toHaveProperty("metadata");
  });

  it("prefers top-level agentRelevance over metadata", async () => {
    mockGraphResponse([
      {
        id: "node-1",
        nodeType: "FEATURE",
        title: "화면",
        summary: null,
        agentRelevance: {
          developer: {
            relevance: 0.7,
            useAs: "implementation_hint",
            reason: "화면 구현",
            promptSummary: "화면 구현 힌트",
          },
        },
        metadata: {
          agentRelevance: {
            security: {
              relevance: 0.9,
              useAs: "risk",
              reason: "보안 위험",
              promptSummary: "보안 위험",
            },
          },
        },
      },
    ]);

    const { nodes } = await fetchProjectGraph("project-1");
    expect(nodes[0]?.agentRelevance?.developer?.useAs).toBe("implementation_hint");
    expect(nodes[0]?.agentRelevance?.security).toBeUndefined();
  });

  it("drops sensitive agentRelevance from metadata", async () => {
    mockGraphResponse([
      {
        id: "node-1",
        nodeType: "FEATURE",
        title: "API",
        summary: null,
        metadata: {
          agentRelevance: {
            developer: {
              relevance: 0.9,
              useAs: "implementation_hint",
              reason: "api_key=sk-live-abcdef1234567890",
              promptSummary: "",
            },
          },
        },
      },
    ]);

    const { nodes } = await fetchProjectGraph("project-1");
    expect(nodes[0]?.agentRelevance?.developer).toBeUndefined();
    expect(nodes[0]?.agentRelevance).toBeUndefined();
  });
});
