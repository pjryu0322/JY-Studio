import { describe, expect, it } from "vitest";
import {
  buildReplayGraphFrameKey,
  createReplayGraphFrame,
  REPLAY_GRAPH_TRANSITION_MS,
} from "@/lib/project-graph/projectKnowledgeReplayViewerTransition";

describe("projectKnowledgeReplayViewerTransition", () => {
  it("uses explicit frameKey when provided", () => {
    expect(
      buildReplayGraphFrameKey("rev-1", [{ id: "a", nodeType: "Feature", title: "t", summary: null }], []),
    ).toBe("rev-1");
  });

  it("builds stable key from node and edge ids", () => {
    const key = buildReplayGraphFrameKey(
      undefined,
      [{ id: "n1", nodeType: "Feature", title: "t", summary: null }],
      [{ id: "e1", fromNodeId: "n1", toNodeId: "n2", edgeType: "rel" }],
    );
    expect(key).toBe("n1::e1");
  });

  it("creates replay graph frame", () => {
    const frame = createReplayGraphFrame({
      frameKey: "r2",
      nodes: [],
      edges: [],
    });
    expect(frame.frameKey).toBe("r2");
  });

  it("uses 150ms transition duration", () => {
    expect(REPLAY_GRAPH_TRANSITION_MS).toBe(150);
  });
});
